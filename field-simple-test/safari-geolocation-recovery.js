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
    let settled = false;
    const finishSuccess = position => {
      if (settled) return;
      settled = true;
      remember(position);
      if (typeof success === "function") success(position);
    };
    const finishFailure = error => {
      if (settled) return;
      settled = true;
      if (typeof failure === "function") failure(error);
    };
    nativeGetCurrentPosition(finishSuccess, error => {
      if (error && Number(error.code) === 1) {
        finishFailure(error);
        return;
      }
      nativeGetCurrentPosition(finishSuccess, fallbackError => {
        if (lastGoodPosition && Date.now() - Number(lastGoodPosition.timestamp || 0) <= 120000) {
          finishSuccess(lastGoodPosition);
          return;
        }
        finishFailure(fallbackError || error);
      }, normalFallbackOptions(options));
    }, preciseAttemptOptions(options));
  }

  function stopNative(record) {
    if (!record) return;
    record.generation += 1;
    if (record.nativeWatchId != null) {
      try { nativeClearWatch(record.nativeWatchId); } catch (error) { /* already gone */ }
      record.nativeWatchId = null;
    }
  }

  function cancelRecord(record) {
    if (!record) return;
    record.cancelled = true;
    stopNative(record);
    virtualWatches.delete(record.virtualId);
  }

  function cancelOtherWatches(exceptId) {
    Array.from(virtualWatches.values()).forEach(record => {
      if (record.virtualId !== exceptId) cancelRecord(record);
    });
  }

  function startNativeWatch(record) {
    if (!record || record.cancelled || record.permissionDenied) return;
    cancelOtherWatches(record.virtualId);
    stopNative(record);
    const generation = record.generation;
    const success = position => {
      if (record.cancelled || record.permissionDenied || record.generation !== generation) return;
      remember(position);
      if (typeof record.success === "function") record.success(position);
    };
    const failure = error => {
      if (record.cancelled || record.generation !== generation) return;
      if (error && Number(error.code) === 1) record.permissionDenied = true;
      stopNative(record);
      if (typeof record.failure === "function") record.failure(error);
    };
    try {
      record.nativeWatchId = nativeWatchPosition(success, failure, preciseAttemptOptions(record.options));
    } catch (error) {
      failure(error);
    }
  }

  function recoveredWatchPosition(success, failure, options) {
    cancelOtherWatches(null);
    const virtualId = nextVirtualWatchId++;
    const record = {
      virtualId,
      success,
      failure,
      options: options || {},
      nativeWatchId: null,
      permissionDenied: false,
      cancelled: false,
      generation: 0
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
    cancelRecord(record);
  }

  function reviveAll() {
    virtualWatches.forEach(record => {
      if (record.cancelled || record.permissionDenied) return;
      startNativeWatch(record);
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
