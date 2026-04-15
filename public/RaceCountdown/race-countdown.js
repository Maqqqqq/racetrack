const socket = io(window.location.origin, {
    transports: ['websocket']
  });
  
  // Create and style the timer container
  const timer = document.createElement("div");
  timer.classList.add("timer");
  document.body.appendChild(timer);
  
  // Listen for race status updates
  socket.on("raceUpdate", (data) => {
    if (!data) return;
  
    if (data.mode === "Finished") {
      updateTimerDisplay(0); // Show 00:00
    } else if (!data.running) {
      const duration = parseInt(data.timerDuration, 10);
      updateTimerDisplay(duration || 60); // Default to 60 if not valid
    }
  });
  
  // Listen for ongoing timer updates
  socket.on("timerUpdate", (remainingTime) => {
    if (typeof remainingTime === "number") {
      updateTimerDisplay(remainingTime);
    }
  });
  
  // Helper function to update the timer display
  function updateTimerDisplay(secondsRemaining) {
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = secondsRemaining % 60;
  
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    timer.textContent = formattedTime;
  }
    // Mouse parallax effect for the animated background
  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1 range
    const y = (e.clientY / window.innerHeight - 0.5) * 2; // -1 to 1 range

    const bg = document.querySelector('.animated-bg');
    if (bg) {
      // Adjust these values to control the intensity of the parallax effect
      const parallaxIntensity = 10; // pixels
      bg.style.backgroundPosition = `${x * parallaxIntensity}px ${y * parallaxIntensity}px`;
    }
  });
  
// Theme Toggle Functionality
document.addEventListener('DOMContentLoaded', () => {
  const themeSwitch = document.getElementById('theme-switch');
  const currentTheme = localStorage.getItem('theme');

  if (currentTheme) {
    document.body.classList.add(currentTheme);
    if (currentTheme === 'light-theme') {
      themeSwitch.checked = true;
    }
  }

  themeSwitch.addEventListener('change', () => {
    if (themeSwitch.checked) {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light-theme');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark-theme'); // Explicitly set dark-theme
    }
  });
});
  
