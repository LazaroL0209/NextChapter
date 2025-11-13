let timerInterval;
let secondsElapsed = 0;
let isPaused = false;

const timerDisplay = document.getElementById("gameTimer");
const startGameBtn = document.getElementById("startGameBtn");
const pauseGameBtn = document.getElementById("pauseGameBtn");

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function startTimer() {
  timerInterval = setInterval(() => {
    secondsElapsed++;
    timerDisplay.textContent = formatTime(secondsElapsed);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

startGameBtn.addEventListener("click", () => {
  if (startGameBtn.textContent === "Start Game") {
    startTimer();
    startGameBtn.textContent = "End Game";
    startGameBtn.classList.remove("btn-primary");
    startGameBtn.classList.add("btn-danger");
  } else {
    stopTimer();
    startGameBtn.textContent = "Start Game";
    startGameBtn.classList.remove("btn-danger");
    startGameBtn.classList.add("btn-primary");
    secondsElapsed = 0;
    timerDisplay.textContent = "00:00";
    pauseGameBtn.textContent = "Pause";
    isPaused = false;
  }
});

pauseGameBtn.addEventListener("click", () => {
  if (!isPaused) {
    stopTimer();
    pauseGameBtn.textContent = "Resume";
    isPaused = true;
  } else {
    startTimer();
    pauseGameBtn.textContent = "Pause";
    isPaused = false;
  }
});