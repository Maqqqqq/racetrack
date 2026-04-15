document.addEventListener('DOMContentLoaded', () => {
  const wrapper = document.querySelector('.wrapper') || document.body;

  const loginForm = document.getElementById('login-form');
  const accessKeyInput = document.getElementById('accessKey');
  const messageDiv = document.getElementById('message');
  const guestButton = document.getElementById('guestButton');

  // Theme toggle logic (copied from Frontdesk.js)
  const themeSwitch = document.getElementById('theme-switch');
  const body = document.body;

  // Load theme from localStorage
  if (localStorage.getItem('theme') === 'light') {
    body.classList.add('light-theme');
    if (themeSwitch) themeSwitch.checked = true;
  }

  if (themeSwitch) {
    themeSwitch.addEventListener('change', function() {
      if (this.checked) {
        body.classList.add('light-theme');
        localStorage.setItem('theme', 'light');
        this.setAttribute('aria-checked', 'true');
      } else {
        body.classList.remove('light-theme');
        localStorage.setItem('theme', 'dark');
        this.setAttribute('aria-checked', 'false');
      }
    });
  }

  // Function to display messages
  function showMessage(message, type = 'error') {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}-message`;
    messageDiv.style.display = 'block';
  }

  // Guest button click handler
  if (guestButton) {
    guestButton.addEventListener('click', () => {
      window.location.href = '/leader-board';
    });
  }

  if (nextRace) {
    nextRace.addEventListener('click', () => {
      window.location.href = '/next-race';
    });
  }
  if (raceCountdown) {
    raceCountdown.addEventListener('click', () => {
      window.location.href = '/race-countdown';
    });
  }
  if (raceFlags) {
    raceFlags.addEventListener('click', () => {
      window.location.href = '/race-flags';
    });
  }
  // Login form submission handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      messageDiv.style.display = 'none'; // Hide previous messages

      const accessKey = accessKeyInput.value;

      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessKey }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Login failed.');
        }

        // Login successful, redirect to Frontdesk
        window.location.href = data.redirectUrl;
      } catch (error) {
        showMessage(error.message, 'error');
      }
    });
  }
});
