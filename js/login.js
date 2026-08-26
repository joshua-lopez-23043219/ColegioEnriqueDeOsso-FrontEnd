/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById('nav-menu'),
   navToggle = document.getElementById('nav-toggle'),
   navClose = document.getElementById('nav-close');

/* Menu show */
if (navToggle) {
   navToggle.addEventListener('click', () => {
      navMenu.classList.add('show-menu');
   });
}

/* Menu hidden */
if (navClose) {
   navClose.addEventListener('click', () => {
      navMenu.classList.remove('show-menu');
   });
}

/*=============== SEARCH ===============*/
const search = document.getElementById('search'),
   searchBtn = document.getElementById('search-btn'),
   searchClose = document.getElementById('search-close');

/* Search show */
if (searchBtn) {
   searchBtn.addEventListener('click', () => {
      search.classList.add('show-search');
   });
}

/* Search hidden */
if (searchClose) {
   searchClose.addEventListener('click', () => {
      search.classList.remove('show-search');
   });
}

/* Search hidden by clicking outside content */
if (search) {
   search.addEventListener('click', (e) => {
      if (e.target === search) {
         search.classList.remove('show-search');
      }
   });
}

/*=============== LOGIN MODAL & AUTHENTICATION ===============*/
const login = document.getElementById('login'),
   loginBtn = document.getElementById('login-btn'),
   loginClose = document.getElementById('login-close'),
   loginForm = document.querySelector('.login__form');

/* Login show */
if (loginBtn) {
   loginBtn.addEventListener('click', () => {
      login.classList.add('show-login');
      // Auto focus username field
      setTimeout(() => {
         const userInput = document.getElementById('username');
         if (userInput) userInput.focus();
      }, 100);
   });
}

/* Login hidden via close button */
if (loginClose) {
   loginClose.addEventListener('click', () => {
      login.classList.remove('show-login');
   });
}

/* Login hidden by clicking outside the modal box */
if (login) {
   login.addEventListener('click', (e) => {
      if (e.target === login) {
         login.classList.remove('show-login');
      }
   });
}

/* Function to perform authentication */
function performLogin() {
   const usernameVal = document.getElementById('username').value.trim();
   const passwordVal = document.getElementById('password').value.trim();
   
   if (!usernameVal || !passwordVal) {
      showToast('Por favor ingrese su usuario y contraseña', 'warning');
      return;
   }
   
   fetch(getApiUrl('/api/login/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameVal, password: passwordVal })
   })
   .then(res => {
      if (!res.ok) {
         return res.json().then(errData => {
            throw new Error(errData.error || 'Credenciales inválidas');
         });
      }
      return res.json();
   })
   .then(data => {
      // Save credentials in localStorage
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      localStorage.setItem('user_username', data.username);
      localStorage.setItem('user_role', data.role);
      localStorage.setItem('user_name', data.name);
      localStorage.setItem('student_code', data.student_code);
      localStorage.setItem('student_id', data.student_id || '');
      localStorage.setItem('teacher_id', data.teacher_id || '');
      localStorage.setItem('tutor_id', data.tutor_id || '');
      
      showToast(`¡Bienvenido/a, ${data.name}!`, 'success');

      // El estudiante entra DIRECTO a su portal. El menu intermedio le
      // ofrecia solo dos tarjetas -- "Mi Portal" y "Boletin" -- y el boletin
      // ya esta dentro del portal, asi que era un clic de mas para llegar a
      // lo unico que iba a ver. El resto de roles si tiene varios modulos y
      // sigue pasando por el menu.
      const destino = data.role === 'ESTUDIANTE'
         ? './portalEstudiante.html'
         : './index.html';

      setTimeout(() => {
         window.location.href = destino;
      }, 1000);
   })
   .catch(err => {
      console.error(err);
      showToast(err.message || 'Error al conectar con el servidor', 'error');
   });
}

// Click listener for access button
const accessBtn = document.getElementById('access-btn');
if (accessBtn) {
   accessBtn.addEventListener('click', (e) => {
      e.preventDefault();
      performLogin();
   });
}

// Submit listener for form (handles Enter key automatically)
if (loginForm) {
   loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      performLogin();
   });
}

// Ayuda informativa sobre Registro y Contraseña Olvidada
document.addEventListener('DOMContentLoaded', () => {
   const signupInfoBtn = document.getElementById('signup-info-btn');
   if (signupInfoBtn) {
      signupInfoBtn.addEventListener('click', (e) => {
         e.preventDefault();
         showToast('Las cuentas de acceso son generadas por la Administración del centro tras realizar el pago de aranceles.', 'info');
      });
   }

   const forgotLink = document.querySelector('.login__forgot');
   if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
         e.preventDefault();
         showToast('Favor contactar con la secretaría o administración académica para el restablecimiento de su clave.', 'warning');
      });
   }

   // Toggle Password Visibility
   const togglePasswordBtn = document.getElementById('toggle-password');
   if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', () => {
         const passwordInput = document.getElementById('password');
         if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            togglePasswordBtn.classList.remove('ri-eye-off-line');
            togglePasswordBtn.classList.add('ri-eye-line');
            togglePasswordBtn.style.color = 'var(--primary)';
         } else {
            passwordInput.type = 'password';
            togglePasswordBtn.classList.remove('ri-eye-line');
            togglePasswordBtn.classList.add('ri-eye-off-line');
            togglePasswordBtn.style.color = 'var(--slate-500)';
         }
      });
   }
});
