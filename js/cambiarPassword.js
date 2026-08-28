/**
 * cambiarPassword.js
 * Cambio obligatorio de la contraseña que entregó el sistema.
 *
 * A esta pantalla se llega de dos maneras: desde el login, cuando la respuesta
 * trae `debe_cambiar_password`, o desde `apiFetch`, que trae aquí a quien
 * intente usar el sistema con la bandera puesta. Mientras siga puesta, el
 * servidor le responde 403 a todo lo demás, así que no hay forma de saltársela
 * cerrando esta página.
 *
 * Las reglas se comprueban aquí solo para avisar mientras se escribe. Quien
 * decide es el servidor, con los validadores de Django.
 */
document.addEventListener('DOMContentLoaded', () => {
  const usuario = localStorage.getItem('user_username') || '';

  // Sin sesión no hay nada que cambiar: se vuelve al login.
  if (!localStorage.getItem('access_token')) {
    window.location.href = 'vistaPrinc.html';
    return;
  }

  document.getElementById('pw_usuario').textContent = usuario || '—';

  const actual = document.getElementById('pw_actual');
  const nueva = document.getElementById('pw_nueva');
  const repetir = document.getElementById('pw_repetir');
  const guardar = document.getElementById('pw_guardar');
  const error = document.getElementById('pw_error');

  // Mostrar/ocultar cada campo
  document.querySelectorAll('.pw__ver').forEach(boton => {
    boton.addEventListener('click', () => {
      const campo = document.getElementById(boton.dataset.para);
      const oculta = campo.type === 'password';
      campo.type = oculta ? 'text' : 'password';
      boton.textContent = oculta ? 'Ocultar' : 'Mostrar';
    });
  });

  function evaluar() {
    const v = nueva.value;
    return {
      largo: v.length >= 8,
      noNumerica: v !== '' && !/^\d+$/.test(v),
      distinta: v !== '' && v !== actual.value,
      noUsuario: v !== '' && usuario !== '' &&
                 v.toLowerCase() !== usuario.toLowerCase(),
    };
  }

  function pintar() {
    const estado = evaluar();
    document.querySelectorAll('#pw_reglas li').forEach(li => {
      li.classList.toggle('ok', !!estado[li.dataset.regla]);
    });
  }

  [actual, nueva].forEach(c => c.addEventListener('input', pintar));

  function mostrarError(texto) {
    error.textContent = texto;
    error.style.display = texto ? 'block' : 'none';
  }

  document.getElementById('pw_form').addEventListener('submit', (e) => {
    e.preventDefault();
    mostrarError('');

    if (nueva.value !== repetir.value) {
      mostrarError('Las dos contraseñas nuevas no coinciden.');
      repetir.focus();
      return;
    }

    guardar.disabled = true;
    guardar.textContent = 'Guardando…';

    apiFetch('/apiUserCreate/UsuarioCreate/cambiar_password/', {
      method: 'POST',
      body: JSON.stringify({
        password_actual: actual.value,
        password_nueva: nueva.value,
      })
    })
      .then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'No se pudo cambiar la contraseña.');
        return data;
      })
      .then(data => {
        showToast(data.message, 'success');
        // Al quedar la bandera en falso, el servidor le abre el resto. El
        // token que tiene sigue siendo suyo y sigue valiendo.
        const rol = localStorage.getItem('user_role');
        setTimeout(() => {
          window.location.href = rol === 'ESTUDIANTE'
            ? './portalEstudiante.html'
            : './index.html';
        }, 1000);
      })
      .catch(err => {
        guardar.disabled = false;
        guardar.textContent = 'Guardar y continuar';
        mostrarError(err.message);
      });
  });

  // Salir sin cambiarla es legítimo -- puede haberse equivocado de cuenta --,
  // pero no da acceso a nada: al volver a entrar vuelve aquí.
  document.getElementById('pw_salir').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'vistaPrinc.html';
  });

  pintar();
});
