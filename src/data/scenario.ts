import portraitMargaret from "../assets/portrait-margaret.svg";
import cameraPreview from "../assets/camera-preview.svg";

// Peer comparison is only statistically meaningful once enough people have played.
export const PEER_THRESHOLD = 50;
export const PLAYERS_COMPLETED = 64;

// Bundled illustrations, so the landing pages work offline and inside locked down networks.
export const PORTRAIT_SRC = portraitMargaret;
// Stands in for the live camera until real capture exists (consent first, transcript only scoring).
export const CAMERA_PREVIEW_SRC = cameraPreview;
