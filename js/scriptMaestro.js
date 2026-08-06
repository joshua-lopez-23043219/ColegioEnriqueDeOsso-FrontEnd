/**
 * scriptMaestro.js — Teacher registration logic with API integration
 */

// Buscar maestro por cédula (Enter key)
document.getElementById("Nmaestro").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const code = this.value.trim();

    if (!code) {
      showToast("Ingrese el número de cédula para buscar", "warning");
      return;
    }

    apiFetch(`/apiTeacher/Teacher/SpecificTeacher/?code_teacher=${encodeURIComponent(code)}`)
      .then(response => {
        if (!response.ok) throw new Error("Maestro no encontrado");
        return response.json();
      })
      .then(dataTR => {
        document.getElementById('Nmaestro').value = dataTR.code_teacher;
        
        // Separar el nombre en nombres y apellidos para los dos campos de la interfaz
        const names = dataTR.name_teacher.split(' ');
        let nombresVal = '';
        let apellidosVal = '';
        if (names.length > 1) {
          const mid = Math.ceil(names.length / 2);
          nombresVal = names.slice(0, mid).join(' ');
          apellidosVal = names.slice(mid).join(' ');
        } else {
          nombresVal = dataTR.name_teacher;
        }

        document.getElementById('nombres').value = nombresVal;
        document.getElementById('apellidos').value = apellidosVal;
        document.getElementById('direccion').value = dataTR.address_teacher;
        document.getElementById('telefono').value = dataTR.phone_teacher;
        document.getElementById('email').value = dataTR.email_teacher;
        
        // Seleccionar la asignatura en el select
        const selectAsig = document.getElementById('asignatura');
        for (let i = 0; i < selectAsig.options.length; i++) {
          if (selectAsig.options[i].text.toLowerCase() === dataTR.area_teacher.toLowerCase()) {
            selectAsig.selectedIndex = i;
            break;
          }
        }

        document.getElementById("id_teacher").value = dataTR.id;
        showToast("Maestro encontrado correctamente", "success");
      })
      .catch(error => {
        showToast("Error al buscar maestro: " + error.message, "error");
        document.getElementById("nombres").value = '';
        document.getElementById("apellidos").value = '';
        document.getElementById("direccion").value = '';
        document.getElementById("telefono").value = '';
        document.getElementById("email").value = '';
        document.getElementById("asignatura").selectedIndex = 0;
        document.getElementById("id_teacher").value = '';
      });
  }
});

// Guardar nuevo maestro
function guardarmaestro(event) {
  event.preventDefault();
  const Nmaestro = document.getElementById("Nmaestro").value.trim();
  const nombres = document.getElementById("nombres").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const asignatura = document.getElementById("asignatura").value;

  if (!Nmaestro || !nombres || !apellidos || !direccion || !telefono || !email || !asignatura) {
    showToast("Completa todos los Campos", "warning");
    return;
  }

  const payload = {
    code_teacher: Nmaestro,
    name_teacher: `${nombres} ${apellidos}`,
    phone_teacher: telefono,
    email_teacher: email,
    address_teacher: direccion,
    area_teacher: asignatura
  };

  apiFetch('/apiTeacher/Teacher/PostTeacher/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) throw new Error("Error al guardar maestro");
      return response.json();
    })
    .then(data => {
      showToast("Maestro guardado correctamente", "success");
      document.getElementById("form-validation").reset();
      document.getElementById("id_teacher").value = '';
    })
    .catch(error => {
      showToast("Error al registrar maestro: " + error.message, "error");
    });
}

// Editar maestro existente
function editarmaestro(event) {
  event.preventDefault();
  const idTeacher = document.getElementById("id_teacher").value;
  const Nmaestro = document.getElementById("Nmaestro").value.trim();
  const nombres = document.getElementById("nombres").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const direccion = document.getElementById("direccion").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const asignatura = document.getElementById("asignatura").value;

  if (!idTeacher) {
    showToast("Por favor, busque un maestro primero para poder editarlo", "warning");
    return;
  }

  if (!Nmaestro || !nombres || !apellidos || !direccion || !telefono || !email || !asignatura) {
    showToast("Completa todos los Campos", "warning");
    return;
  }

  const payload = {
    id: idTeacher,
    code_teacher: Nmaestro,
    name_teacher: `${nombres} ${apellidos}`,
    phone_teacher: telefono,
    email_teacher: email,
    address_teacher: direccion,
    area_teacher: asignatura
  };

  apiFetch('/apiTeacher/Teacher/UpdateTeacher/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) throw new Error("Error al actualizar maestro");
      return response.json();
    })
    .then(data => {
      showToast("Maestro actualizado correctamente", "success");
      document.getElementById("form-validation").reset();
      document.getElementById("id_teacher").value = '';
    })
    .catch(error => {
      showToast("Error al actualizar maestro: " + error.message, "error");
    });
}

// Eliminar maestro
function eliminarmaestro(event) {
  event.preventDefault();
  const idTeacher = document.getElementById("id_teacher").value;

  if (!idTeacher) {
    showToast("Por favor, busque un maestro primero para poder eliminarlo", "warning");
    return;
  }

  if (!confirm("¿Está seguro de que desea eliminar a este maestro?")) {
    return;
  }

  const payload = {
    id: idTeacher
  };

  apiFetch('/apiTeacher/Teacher/DeleteTeacher/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) throw new Error("Error al eliminar maestro");
      return response.json();
    })
    .then(data => {
      showToast("Maestro eliminado correctamente", "success");
      document.getElementById("form-validation").reset();
      document.getElementById("id_teacher").value = '';
    })
    .catch(error => {
      showToast("Error al eliminar maestro: " + error.message, "error");
    });
}