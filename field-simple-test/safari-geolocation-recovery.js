(function () {
  "use strict";

  if (!navigator.geolocation || navigator.geolocation.__propertyInspectorRecoveryInstalled) return;

  const geo = navigator.geolocation;
  const nativeGetCurrentPosition = geo.getCurrentPosition.bind(geo);
  const nativeWatchPosition = geo.watchPosition.bind(geo);
  const nativeClearWatch = geo.clearWatch.bind(geo);
  const virtualWatches = new Map();
  let nextVirtualWatchId = 1000000;
  let lastGoodPosition = null;

  function remember(position) {
    if (position && position.coords) lastGoodPosition = position;
    return position;
  }

  function normalFallbackOptions(options) {
    return {
      enableHighAccuracy: false,
      maximumAge: Math.max(Number(options && options.maximumAge) || 0, 30000),
      timeout: Math.max(8000, Math.min(Number(options && options.timeout) || 12000, 12000))
    };
  }

  function preciseAttemptOptions(options) {
    return {
      enableHighAccuracy: options && options.enableHighAccuracy !== undefined ? Boolean(options.enableHighAccuracy) : true,
      maximumAge: Number(options && options.maximumAge) || 0,
      timeout: Math.max(5000, Math.min(Number(options && options.timeout) || 10000, 10000))
    };
  }

  function recoveredGetCurrentPosition(success, failure, options) {
    const onSuccess = position => {
      remember(position);
      if (typeof success === "function") success(position);
    };
    const onFailure = error => {
      if (error && error.code === 1) {
        if (typeof failure === "function") failure(error);
        return;
      }
      nativeGetCurrentPosition(onSuccess, fallbackError => {
        if (lastGoodPosition && Date.now() - Number(lastGoodPosition.timestamp || 0) <= 120000) {
          onSuccess(lastGoodPosition);
          return;
        }
        if (typeof failure === "function") failure(fallbackError || error);
      }, normalFallbackOptions(options));
    };
    nativeGetCurrentPosition(onSuccess, onFailure, preciseAttemptOptions(options));
  }

  function stopNative(record) {
    if (!record) return;
    if (record.nativeWatchId != null) {
      try { nativeClearWatch(record.nativeWatchId); } catch (error) { /* already gone */ }
      record.nativeWatchId = null;
    }
    if (record.restartTimer) {
      clearTimeout(record.restartTimer);
      record.restartTimer = null;
    }
  }

  function scheduleRestart(record, delay) {
    if (!record || record.cancelled || record.restartTimer) return;
    record.restartTimer = setTimeout(() => {
      record.restartTimer = null;
      startNativeWatch(record);
    }, delay == null ? 1200 : delay);
  }

  function startNativeWatch(record) {
    if (!record || record.cancelled) return;
    stopNative(record);
    const success = position => {
      record.failureCount = 0;
      remember(position);
      if (typeof record.success === "function") record.success(position);
    };
    const failure = error => {
      record.failureCount += 1;
      if (error && error.code === 1) {
        if (!record.permissionErrorReported && typeof record.failure === "function") {
          record.permissionErrorReported = true;
          record.failure(error);
        }
        scheduleRestart(record, 5000);
        return;
      }
      recoveredGetCurrentPosition(success, fallbackError => {
        if (record.failureCount === 1 && typeof record.failure === "function") record.failure(fallbackError || error);
        scheduleRestart(record, Math.min(5000, 800 + record.failureCount * 700));
      }, record.options);
    };
    try {
      record.nativeWatchId = nativeWatchPosition(success, failure, preciseAttemptOptions(record.options));
    } catch (error) {
      failure(error);
    }
  }

  function recoveredWatchPosition(success, failure, options) {
    const virtualId = nextVirtualWatchId++;
    const record = {
      virtualId,
      success,
      failure,
      options: options || {},
      nativeWatchId: null,
      restartTimer: null,
      failureCount: 0,
      permissionErrorReported: false,
      cancelled: false
    };
    virtualWatches.set(virtualId, record);
    startNativeWatch(record);
    return virtualId;
  }

  function recoveredClearWatch(id) {
    const record = virtualWatches.get(id);
    if (!record) {
      try { nativeClearWatch(id); } catch (error) { /* unknown native id */ }
      return;
    }
    record.cancelled = true;
    stopNative(record);
    virtualWatches.delete(id);
  }

  function reviveAll() {
    virtualWatches.forEach(record => {
      if (record.cancelled) return;
      record.permissionErrorReported = false;
      scheduleRestart(record, 0);
    });
  }

  try {
    geo.getCurrentPosition = recoveredGetCurrentPosition;
    geo.watchPosition = recoveredWatchPosition;
    geo.clearWatch = recoveredClearWatch;
    Object.defineProperty(geo, "__propertyInspectorRecoveryInstalled", { value: true, configurable: false });
  } catch (error) {
    return;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reviveAll();
  });
  window.addEventListener("pageshow", reviveAll);
  window.addEventListener("focus", reviveAll);
})();
