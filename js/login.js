/*=============== SHOW MENU ===============*/
const navMenu = document.getElementById('nav-menu'),
   navToggle = document.getElementById('nav-toggle'),
   navClose = document.getElementById('nav-close')

/* Menu show */
navToggle.addEventListener('click', () => {
   navMenu.classList.add('show-menu')
})

/* Menu hidden */
navClose.addEventListener('click', () => {
   navMenu.classList.remove('show-menu')
})

/*=============== SEARCH ===============*/
const search = document.getElementById('search'),
   searchBtn = document.getElementById('search-btn'),
   searchClose = document.getElementById('search-close')

/* Search show */
searchBtn.addEventListener('click', () => {
   search.classList.add('show-search')
})

/* Search hidden */
searchClose.addEventListener('click', () => {
   search.classList.remove('show-search')
})

/*=============== LOGIN ===============*/
const login = document.getElementById('login'),
   loginBtn = document.getElementById('login-btn'),
   loginClose = document.getElementById('login-close')

/* Login show */
loginBtn.addEventListener('click', () => {
   login.classList.add('show-login')
})

/* Login hidden */
loginClose.addEventListener('click', () => {
   login.classList.remove('show-login')
})

const accessBtn = document.getElementById('access-btn');
accessBtn.addEventListener('click', () => {
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
      
      // Redirect to portal index.html
      setTimeout(() => {
         window.location.href = './index.html';
      }, 1000);
   })
   .catch(err => {
      console.error(err);
      showToast(err.message || 'Error al conectar con el servidor', 'error');
   });
});

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
});
