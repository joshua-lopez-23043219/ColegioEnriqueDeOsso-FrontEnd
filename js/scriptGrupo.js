/**
 * scriptGrupo.js — Group registration logic with API integration
 * goBack() and dropdown code removed (now in global.js)
 */

// Guardar grupo
function guardargrupo(e) {
  e.preventDefault();

  const grupo = {
    code_group: document.getElementById("code_group").value,
    level_group: document.getElementById("level_group").value,
    section_group: document.getElementById("section_group").value,
    amount_group: parseInt(document.getElementById("amount_group").value),
    shift_group: document.getElementById("turno").value
  };

  if (grupo.amount_group > 41) {
    showToast("No puedes registrar más de 40 alumnos por grupo.", "error");
    return;
  }

  apiFetch('/apiGroup/Group/PostGroup/', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(grupo)
  })
    .then(async (res) => {
      const data = await res.json();

      if (!res.ok) {
        console.error("Error de validación:", data);

        let errores = data.error || data;
        let mensaje = "";

        for (let campo in errores) {
          const mensajeCampo = Array.isArray(errores[campo])
            ? errores[campo].join(", ")
            : errores[campo];
          mensaje += `• ${campo}: ${mensajeCampo}\n`;
        }

        throw new Error(mensaje || "Error desconocido");
      }

      showToast(data.message || "✅ Grupo creado correctamente", "info");
      document.getElementById("form-validation").reset();
    })
    .catch((err) => {
      showToast("❌ " + err.message, "info");
    });
}

// Editar grupo
function editargrupo(e) {
  e.preventDefault();

  const id = prompt("🔍 Ingrese el ID del grupo a editar:");
  if (!id) return;

  const grupo = {
    code_group: document.getElementById("code_group").value,
    level_group: document.getElementById("level_group").value,
    section_group: document.getElementById("section_group").value,
    amount_group: parseInt(document.getElementById("amount_group").value),
    shift_group: document.getElementById("turno").value
  };

  apiFetch(`/apiGroup/Group/${id}/UpdateGroup/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(grupo)
  })
    .then(res => {
      if (!res.ok) return res.json().then(data => { throw new Error(data.error || "Error al editar") });
      return res.json();
    })
    .then(data => {
      showToast(data.message || "✅ Grupo actualizado correctamente", "info");
      document.getElementById("form-validation").reset();
    })
    .catch(err => showToast("❌ " + err.message), "info");
}

// Buscar grupo por código (Enter key)
document.getElementById('code_group').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault();

    const code = document.getElementById('code_group').value.trim();
    if (!code) {
      showToast("Ingrese un código de grupo", "warning");
      return;
    }

    apiFetch(`/apiGroup/Group/SpecificGroup/?code_group=${encodeURIComponent(code)}`)
      .then(res => res.json().then(data => ({ status: res.status, body: data })))
      .then(({ status, body }) => {
        if (status === 200) {
          document.getElementById('code_group').value = body.code_group;
          document.getElementById('level_group').value = body.level_group;
          document.getElementById('section_group').value = body.section_group;
          document.getElementById('amount_group').value = body.amount_group;
          document.getElementById('turno').value = body.shift_group;
          showToast("Grupo encontrado", "success");
        } else {
          showToast('❌ ' + (body.error || 'Grupo no encontrado'), "info");
        }
      })
      .catch(() => showToast('❌ Error al buscar grupo'), "info");
  }
});