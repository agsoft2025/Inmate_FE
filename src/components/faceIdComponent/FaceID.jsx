import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, Sun, ScanFace, Crosshair, Info } from "lucide-react";
import { useSnackbar } from "notistack";

// ---------------------------------------------------------------------------
// Face Verification Hardening - pure helper functions.
//
// Kept dependency-free (no DOM/face-api types) so they can be unit tested in
// isolation, and exported so callers that render match results (Login.jsx,
// CanteenPosSystem.jsx) can reuse the same confidence formula rather than
// inventing their own.
// ---------------------------------------------------------------------------

// Converts a face descriptor "distance" (lower = closer match) - as
// returned by the backend's euclidean-distance comparison, see
// Inmate_BE/src/controllers/authController.js and inmateControllers.js's
// fetchInmateDataUsingFace - into a rough 0-100 display confidence.
//
// This is a cosmetic UI heuristic, not a statistical probability. It's
// anchored to the backend's MATCH_THRESHOLD (currently 0.4) so a
// just-barely-passing match reads as "solid but not perfect" (~75%) rather
// than 0%. If the backend threshold changes, update `threshold` here too -
// there's no shared constant between FE/BE in this codebase today.
export const distanceToConfidence = (distance, threshold = 0.4) => {
    if (distance == null || Number.isNaN(distance)) return null;

    let confidence;
    if (distance <= threshold) {
        // 100% at a perfect match (distance 0) down to 70% right at the
        // pass/fail threshold - a "just barely passed" match should still
        // read as solid, not alarmingly low.
        confidence = 100 - 30 * (distance / threshold);
    } else {
        // 70% at the threshold down to 0% by twice the threshold away.
        const over = Math.min(distance - threshold, threshold);
        confidence = 70 - 70 * (over / threshold);
    }

    return Math.max(0, Math.min(100, Math.round(confidence)));
};

// Lighting - classifies the average perceived brightness (0-255) of a
// sampled video frame.
export const classifyLighting = (avgBrightness) => {
    if (avgBrightness == null) return { status: "unknown", label: "Checking lighting..." };
    if (avgBrightness < 60) return { status: "warn", label: "Too dark - add more light" };
    if (avgBrightness > 210) return { status: "warn", label: "Too bright - reduce glare" };
    return { status: "good", label: "Lighting looks good" };
};

// Angle - classifies horizontal head turn (yaw) from a normalized offset
// between the nose tip and the midpoint of the eyes (0 = facing straight
// on; larger magnitude = more turned).
export const classifyAngle = (yawOffset) => {
    if (yawOffset == null) return { status: "unknown", label: "Checking angle..." };
    if (Math.abs(yawOffset) > 0.15) return { status: "warn", label: "Turn to face the camera directly" };
    return { status: "good", label: "Facing the camera" };
};

// Centering - classifies the detected face box against the video frame:
// too small/large (too far/close) or off from center.
export const classifyCentering = ({ offsetX, offsetY, widthRatio } = {}) => {
    if (offsetX == null || widthRatio == null) return { status: "unknown", label: "Checking position..." };
    if (widthRatio < 0.18) return { status: "warn", label: "Move closer to the camera" };
    if (widthRatio > 0.7) return { status: "warn", label: "Move back a little" };
    if (Math.abs(offsetX) > 0.18 || Math.abs(offsetY) > 0.18) {
        return { status: "warn", label: "Center your face in the frame" };
    }
    return { status: "good", label: "Well centered" };
};

// "Why did this fail?" - builds a plain-language reasons list from
// whatever signals are available at the time of a failed attempt: what the
// capture loop itself saw (no face / multiple faces), the most recent
// quality readings, and - for a verified match attempt - the backend's own
// message. There's always at least one line, even if every signal looked
// fine (a genuine "not you" case still deserves a helpful answer).
export const buildFailureReasons = ({ captureIssue, quality, verifyMessage } = {}) => {
    const reasons = [];

    if (captureIssue === "no-face") {
        reasons.push("No face was detected - make sure your full face is in frame.");
    }
    if (captureIssue === "multiple-faces") {
        reasons.push("More than one face was visible - only one person should be in frame.");
    }

    if (quality?.lighting?.status === "warn") reasons.push(`${quality.lighting.label}.`);
    if (quality?.angle?.status === "warn") reasons.push(`${quality.angle.label}.`);
    if (quality?.centering?.status === "warn") reasons.push(`${quality.centering.label}.`);

    if (verifyMessage) reasons.push(verifyMessage);

    if (!reasons.length) {
        reasons.push("No specific issue detected - try again with steady, even lighting and look straight at the camera.");
    }

    return reasons;
};

// Samples a small region of the live video onto an offscreen canvas and
// returns the average perceived brightness (0-255). DOM-dependent, so kept
// out of the pure-helper set above.
const sampleBrightness = (video, canvas) => {
    if (!video || !canvas) return null;
    const w = 48;
    const h = 36;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    try {
        ctx.drawImage(video, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
            sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        return sum / (data.length / 4);
    } catch {
        return null;
    }
};

// Derives yaw offset (angle) and centering inputs from a face-api
// detection-with-landmarks result plus the live video element's dimensions.
const analyzeGeometry = (detection, videoEl) => {
    const box = detection?.detection?.box;
    const landmarks = detection?.landmarks;
    if (!box || !landmarks || !videoEl) return { yawOffset: null, centering: null };

    const videoW = videoEl.videoWidth || videoEl.clientWidth || 1;
    const videoH = videoEl.videoHeight || videoEl.clientHeight || 1;

    const avgPoint = (pts) => ({
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    });

    const leftEyeC = avgPoint(landmarks.getLeftEye());
    const rightEyeC = avgPoint(landmarks.getRightEye());
    const nose = landmarks.getNose();
    const noseTip = nose[Math.floor(nose.length / 2)] || avgPoint(nose);
    const eyeMid = { x: (leftEyeC.x + rightEyeC.x) / 2, y: (leftEyeC.y + rightEyeC.y) / 2 };
    const eyeDist = Math.hypot(rightEyeC.x - leftEyeC.x, rightEyeC.y - leftEyeC.y) || 1;

    const yawOffset = (noseTip.x - eyeMid.x) / eyeDist;

    const boxCenterX = box.x + box.width / 2;
    const boxCenterY = box.y + box.height / 2;

    const centering = {
        offsetX: (boxCenterX - videoW / 2) / videoW,
        offsetY: (boxCenterY - videoH / 2) / videoH,
        widthRatio: box.width / videoW,
    };

    return { yawOffset, centering };
};

// A small pill showing one live quality signal (lighting / angle / centering).
function QualityChip({ icon, item }) {
    const status = item?.status || "unknown";
    const label = item?.label || "Checking...";
    const styles = {
        good: "bg-green-100 text-green-700 border-green-300",
        warn: "bg-amber-100 text-amber-700 border-amber-300",
        unknown: "bg-gray-100 text-gray-500 border-gray-300",
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] leading-none ${styles[status]}`}>
            {icon}
            {label}
        </span>
    );
}

// "Why did this fail?" - a lightweight self-contained popover (this file
// doesn't otherwise depend on MUI, so a plain button + absolutely
// positioned panel matches the existing minimal style here).
function FailureReasonTooltip({ reasons }) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative inline-block mt-2">
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-700 underline decoration-dotted"
            >
                <Info size={12} /> Why did this fail?
            </button>
            {show && (
                <div className="absolute z-10 mt-2 w-64 -translate-x-1/2 left-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs text-gray-700 shadow-lg">
                    <ul className="list-disc pl-4 space-y-1">
                        {reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default function FaceRecognition({
    mode = 'register',
    open,
    setOpen,
    setFaceIdData,
    // Face Verification Hardening - optional. When provided (Login.jsx and
    // CanteenPosSystem.jsx both wire this up for their mode="match" flows),
    // FaceID performs the backend match itself, shows the result (including
    // match confidence) in this modal, and only then hands off via
    // setFaceIdData(descriptorArray, result). If omitted, behavior is
    // exactly the original: capture -> setFaceIdData(descriptorArray) ->
    // close, unchanged (this is what register mode still does).
    onVerify,
}) {
    const videoRef = useRef();
    const streamRef = useRef(null);
    const [status, setStatus] = useState('Loading models...');
    const [countdown, setCountdown] = useState(null); // countdown state
    const { enqueueSnackbar } = useSnackbar();

    // Live capture quality (lighting / angle / centering).
    const [quality, setQuality] = useState({ lighting: null, angle: null, centering: null });
    const qualityRef = useRef(quality);
    useEffect(() => {
        qualityRef.current = quality;
    }, [quality]);

    // Liveness - "turn your head slightly" is shown during the countdown;
    // this is a soft/informational signal only (never blocks capture) that
    // confirms the head actually moved rather than staying perfectly still.
    const [livenessMoved, setLivenessMoved] = useState(false);
    const yawBaselineRef = useRef(null);

    // Verification (match mode + onVerify only).
    const [verifying, setVerifying] = useState(false);
    const [verifyResult, setVerifyResult] = useState(null); // { success, confidence, message }
    const [failCount, setFailCount] = useState(0);
    const [lastFailure, setLastFailure] = useState(null); // { captureIssue, verifyMessage, quality }

    const busyRef = useRef(false); // guards against overlapping face-api detection calls
    const canvasRef = useRef(null);
    const openRef = useRef(open);
    const retryTimeoutRef = useRef(null);
    const successTimeoutRef = useRef(null);

    useEffect(() => {
        openRef.current = open;
    }, [open]);

    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.4,
    });

    useEffect(() => {
        if (!open) {
            stopCamera();
            return;
        }

        // Fresh session - reset hardening state so a previous attempt's
        // readings/failures don't leak into a new one.
        setQuality({ lighting: null, angle: null, centering: null });
        setLivenessMoved(false);
        setVerifying(false);
        setVerifyResult(null);
        setFailCount(0);
        setLastFailure(null);
        yawBaselineRef.current = null;

        const loadModels = async () => {
            const MODEL_URL = "/models";
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
            setStatus("Models loaded. Starting camera...");
            startVideo();
        };

        loadModels();

        return () => {
            stopCamera();
        };
    }, [open]);

    // Live capture quality loop - runs continuously while the camera is on
    // (independent of the countdown/capture phase) so the indicator is
    // useful from the moment the preview appears. Shares `busyRef` with the
    // capture loop below so the two never run face-api detection at once.
    useEffect(() => {
        if (!open) return undefined;
        let cancelled = false;

        const tick = async () => {
            if (cancelled || busyRef.current) return;
            if (!videoRef.current || videoRef.current.readyState < 2) return;

            busyRef.current = true;
            try {
                const detection = await faceapi
                    .detectSingleFace(videoRef.current, detectionOptions)
                    .withFaceLandmarks();

                if (cancelled) return;

                if (!canvasRef.current) canvasRef.current = document.createElement("canvas");
                const brightness = sampleBrightness(videoRef.current, canvasRef.current);
                const lighting = classifyLighting(brightness);

                if (!detection) {
                    setQuality({
                        lighting,
                        angle: { status: "unknown", label: "No face detected" },
                        centering: { status: "unknown", label: "No face detected" },
                    });
                    return;
                }

                const { yawOffset, centering } = analyzeGeometry(detection, videoRef.current);
                setQuality({
                    lighting,
                    angle: classifyAngle(yawOffset),
                    centering: classifyCentering(centering),
                });

                // Liveness: track how much the head has turned since we
                // started watching, purely to surface a "movement detected"
                // confirmation - never gates capture.
                if (yawOffset != null) {
                    if (yawBaselineRef.current == null) {
                        yawBaselineRef.current = yawOffset;
                    } else if (!livenessMoved && Math.abs(yawOffset - yawBaselineRef.current) > 0.08) {
                        setLivenessMoved(true);
                    }
                }
            } catch {
                // Transient detection hiccup - keep the last known quality reading.
            } finally {
                busyRef.current = false;
            }
        };

        const interval = setInterval(tick, 600);
        tick();

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const startVideo = () => {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => {
                streamRef.current = stream;
                if (!videoRef.current) return;
                videoRef.current.srcObject = stream;

                videoRef.current.onloadedmetadata = async () => {
                    try {
                        await videoRef.current.play();
                        const waitForData = setInterval(() => {
                            if (videoRef.current && videoRef.current.readyState >= 2) {
                                clearInterval(waitForData);
                                setStatus("Camera started.");
                                startCountdown(); // 🔹 trigger countdown before detection
                            }
                        }, 100);
                    } catch (err) {
                        enqueueSnackbar("Unable to start video playback", { variant: 'error' });
                    }
                };
            })
            .catch(err => {
                console.error("Camera error:", err);
                enqueueSnackbar("Unable to access camera", { variant: 'error' });
            });
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCountdown(null);
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
            successTimeoutRef.current = null;
        }
    };

    // 🔹 Countdown before detection starts
    const startCountdown = () => {
        yawBaselineRef.current = null;
        setLivenessMoved(false);

        let counter = 3;
        setCountdown(counter);
        const timer = setInterval(() => {
            counter -= 1;
            if (counter === 0) {
                clearInterval(timer);
                setCountdown(null);
                setStatus("Looking for your face...");
                startAutoDetection(); // start detection after countdown
            } else {
                setCountdown(counter);
            }
        }, 1000);
    };

    const startAutoDetection = () => {
        let hasCaptured = false;
        const detectionInterval = setInterval(async () => {
            if (hasCaptured || !videoRef.current) return;

            if (!(videoRef.current instanceof HTMLVideoElement) || videoRef.current.readyState < 2) {
                return;
            }
            if (busyRef.current) return; // let the quality-analysis tick finish first

            busyRef.current = true;
            try {
                const detection = await faceapi
                    .detectSingleFace(videoRef.current, detectionOptions)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    hasCaptured = true;
                    clearInterval(detectionInterval);
                    captureFace(detection.descriptor);
                }
            } finally {
                busyRef.current = false;
            }
        }, 500);

        const cleanup = () => clearInterval(detectionInterval);
        window.addEventListener("beforeunload", cleanup);
        return cleanup;
    };

    // Records a failed attempt (capture-level or verification-level) so
    // repeated failures can surface a useful "why did this fail?" tooltip
    // instead of only a generic toast.
    const registerFailure = ({ captureIssue, verifyMessage } = {}) => {
        setFailCount((c) => c + 1);
        setLastFailure({ captureIssue, verifyMessage, quality: qualityRef.current });
    };

    const usesVerifyPanel = mode !== "register" && Boolean(onVerify);

    const captureFace = async (descriptorFromLoop) => {
        // Guards against a manual "Match Face"/"Register Face" click while a
        // verification is already in flight (the auto-detection loop can't
        // double-fire since it clears its own interval before calling this).
        if (verifying) return;

        const detections = await faceapi
            .detectAllFaces(videoRef.current, detectionOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();

        if (!detections || detections.length === 0) {
            enqueueSnackbar('No face detected. Try again.', { variant: 'warning' });
            registerFailure({ captureIssue: "no-face" });
            return;
        }

        if (detections.length > 1) {
            enqueueSnackbar('Multiple faces detected. Please ensure only one face is visible.', { variant: 'warning' });
            registerFailure({ captureIssue: "multiple-faces" });
            return;
        }

        const descriptorArray = Array.from(detections[0].descriptor);

        if (!descriptorArray || !descriptorArray.length) return;

        if (usesVerifyPanel) {
            setVerifying(true);
            setVerifyResult(null);

            let result;
            try {
                result = await onVerify(descriptorArray);
            } catch (err) {
                result = {
                    success: false,
                    confidence: null,
                    message: err?.response?.data?.message || err?.message || "Verification failed",
                };
            }

            if (!openRef.current) return; // modal was closed while we were awaiting

            setVerifying(false);
            setVerifyResult(result);

            if (result?.success) {
                setFailCount(0);
                setLastFailure(null);
                successTimeoutRef.current = window.setTimeout(() => {
                    if (!openRef.current) return;
                    setFaceIdData(descriptorArray, result);
                    setOpen(false);
                }, 900);
            } else {
                registerFailure({ verifyMessage: result?.message });
                // Give the user a moment to read the result, then try again
                // automatically (no need to re-run the 3-2-1 countdown).
                retryTimeoutRef.current = window.setTimeout(() => {
                    if (!openRef.current) return;
                    setVerifyResult(null);
                    startAutoDetection();
                }, 1600);
            }
            return;
        }

        // Register mode (or match mode without onVerify) - unchanged from
        // the original behavior.
        setFaceIdData(descriptorArray);
        setOpen(false);
        if (mode === "register") {
            enqueueSnackbar('Face detected', { variant: 'success' });
        }
    };

    if (!open) return null;

    return (
        <div className='absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center z-9999 bg-black/30'>
            <div className='flex flex-col gap-4 items-center justify-center'>
                <p className='text-xl bg-white px-4 py-2 rounded-sm'>
                    {countdown !== null ? `Capturing in ${countdown}...` : status}
                </p>

                {/* Liveness prompt - shown only during the 3-2-1 countdown. */}
                {countdown !== null && (
                    <p className='text-sm bg-white/95 px-3 py-1 rounded-sm text-gray-700 flex items-center gap-1'>
                        {livenessMoved ? "✓ Movement detected" : "Turn your head slightly for a liveness check"}
                    </p>
                )}

                {/* Live capture quality indicator - lighting / angle / centering. */}
                <div className="flex flex-wrap justify-center gap-2">
                    <QualityChip icon={<Sun size={12} />} item={quality.lighting} />
                    <QualityChip icon={<ScanFace size={12} />} item={quality.angle} />
                    <QualityChip icon={<Crosshair size={12} />} item={quality.centering} />
                </div>

                <video ref={videoRef} autoPlay muted width="480" height="360" />

                {/* Match confidence / verification result (mode="match" with onVerify only). */}
                {usesVerifyPanel && (verifying || verifyResult) && (
                    <div
                        className={`w-full max-w-xs rounded-lg border px-4 py-3 text-center ${
                            verifying
                                ? "bg-blue-50 border-blue-200"
                                : verifyResult?.success
                                    ? "bg-green-50 border-green-300"
                                    : "bg-red-50 border-red-300"
                        }`}
                    >
                        {verifying ? (
                            <p className="text-sm text-blue-700">Verifying...</p>
                        ) : verifyResult?.success ? (
                            <>
                                <p className="text-sm font-semibold text-green-700">
                                    Verified
                                    {verifyResult.confidence != null ? ` - ${verifyResult.confidence}% match confidence` : ""}
                                </p>
                                {verifyResult.confidence != null && (
                                    <div className="mt-2 h-2 w-full rounded-full bg-green-100 overflow-hidden">
                                        <div className="h-full bg-green-500" style={{ width: `${verifyResult.confidence}%` }} />
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-semibold text-red-700">
                                    {verifyResult?.message || "Verification failed"}
                                </p>
                                {failCount >= 2 && lastFailure && (
                                    <FailureReasonTooltip reasons={buildFailureReasons(lastFailure)} />
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Repeated capture-level failures (no face / multiple faces) in
                    register mode, or in match mode before onVerify ever runs. */}
                {!usesVerifyPanel && failCount >= 2 && lastFailure && (
                    <FailureReasonTooltip reasons={buildFailureReasons(lastFailure)} />
                )}

                <div className='flex gap-4'>
                    <button
                        onClick={() => setOpen(false)}
                        className="bg-white px-4 py-2 rounded-xl hover:bg-gray-200 transition"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => captureFace()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
                    >
                        <Camera size={20} />
                        {mode === "register" ? "Register Face" : "Match Face"}
                    </button>
                </div>
            </div>
        </div>
    );
}
