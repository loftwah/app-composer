const player = document.getElementById("keep-a-copy-player");
if (player instanceof HTMLVideoElement && player.dataset.startSeconds) {
  const position = Number(player.dataset.startSeconds);
  const seek = () => {
    if (Number.isFinite(position) && position >= 0 && position <= player.duration) {
      player.currentTime = position;
    }
  };
  if (player.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
  else player.addEventListener("loadedmetadata", seek, { once: true });
}
