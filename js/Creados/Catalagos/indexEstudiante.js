//  $(function () {
//      var estudianteService = new EstudianteService();

//      estudianteService.Url = "/apiRegistration/Registration/";
//      estudianteService.API = "DetalleRegistro";
//      estudianteService.Method = "GET";

//      estudianteService.getEstudiantes()
//          .then(function (data) {
//              console.log(data);
//              var $tabla = $("#tablaEstudiantes");
//              var fila = "";
//              data.forEach((element, i) => {
//                  fila += `<tr>
//                          <td>${i + 1}</td>
//                          <td>${element.code_registration}</td>
//                          <td>${element.code_student}</td>
//                          <td>${element.name_student}</td>
//                          <td>${element.surname_student}</td>
//                          <td>${element.birthday_student}</td>
//                          <td>${element.phone_student}</td>
//                          <td>${element.email_student}</td>
//                          <td>${element.level_group}</td>
//                          <td>${element.section_group}</td>
//                          <td>${element.name_tutor}</td>
//                          <td>${element.phone_tutor}</td>
//                          <td>${element.address_tutor}</td>

//                     </tr>`;            });

//         $tabla.append(fila);
//             })        .catch(function (error) {            console.error("Error al obtener los datos del estudiante:", error);        });
//         });






// Uso
// $(function () {
//     const estudianteService = new EstudianteService();

//     estudianteService.getEstudiantes()
//         .then(function (data) {
//             console.log("Datos recibidos:", data);
//             var $tabla = $("#tablaEstudiantes");
//             var fila = "";
//             data.forEach((element, i) => {
//                 fila += `<tr>
//                         <td>${i + 1}</td>
//                         <td>${element.code_registration}</td>
//                         <td>${element.code_student}</td>
//                         <td>${element.name_student}</td>
//                         <td>${element.surname_student}</td>
//                         <td>${element.birthday_student}</td>
//                         <td>${element.phone_student}</td>
//                         <td>${element.email_student}</td>
//                         <td>${element.level_group}</td>
//                         <td>${element.section_group}</td>
//                         <td>${element.name_tutor}</td>
//                         <td>${element.phone_tutor}</td>
//                         <td>${element.address_tutor}</td>

//                     </tr>`;
//             });

//             $tabla.append(fila);
//         })
//         .catch(function (error) {
//             console.error("Error completo:", error);
//             showToast(`Error CORS: ${error.message}\nVerifica la consola para detalles`, "info");
//         });
// });

var Url = '/';

document.addEventListener('DOMContentLoaded', function () {
    // 1. Seleccionar el tbody de la tabla
    const tbody = document.querySelector('#tablaStudent tbody');

    // 2. Verificar si existe el elemento
    if (!tbody) {
        console.error('No se encontró el elemento tbody');
        return;
    }
    // poner la URL de la API
    apiFetch('/apiRegistration/Registration/DetalleRegistro/')
        .then(response => {
            if (!response.ok) throw new Error('Error en la respuesta');
            return response.json();
        })
        .then(data => {


            // Llenar tabla con los datos
            data.forEach(item => {
                // Hacer referencia a la fila del tbody
                const fila = tbody.insertRow();

                // Añadir celdas según la estructura de tu JSON
                fila.insertCell(0).textContent = item.code_registration;
                fila.insertCell(1).textContent = item.code_student;
                fila.insertCell(2).textContent = item.name_student + " " + item.surname_student;
                //fila.insertCell(3).textContent = item.surname_student;
                fila.insertCell(3).textContent = item.birthday_student;
                fila.insertCell(4).textContent = item.phone_student;
                fila.insertCell(5).textContent = item.email_student;
                fila.insertCell(6).textContent = item.level_group;
                fila.insertCell(7).textContent = item.section_group;
                fila.insertCell(8).textContent = item.name_tutor;
                fila.insertCell(9).textContent = item.phone_tutor;
                fila.insertCell(10).textContent = item.address_tutor;
                // Añadir más celdas si es necesario
            });
        })

});






document.addEventListener('DOMContentLoaded', function () {
    // Buscar estudiante al presionar Enter
    document.getElementById('code_student').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarEstudiante();
        }
    });

    // Asociar funciones a los botones
    document.getElementById('register-btn').addEventListener('click', registrarEstudiante);
    document.getElementById('edit-btn').addEventListener('click', editarEstudiante);
    document.getElementById('btn-create-user').addEventListener('click', crearCuentaUsuario);
});

function recolectarDatosEstudiante() {
    return {
        code_student: document.getElementById('code_student').value.trim(),
        name_student: document.getElementById('name_student').value.trim(),
        surname_student: document.getElementById('surname_student').value.trim(),
        birthday_student: document.getElementById('birthday_student').value,
        phone_student: document.getElementById('phone_student').value.trim(),
        email_student: document.getElementById('email_student').value.trim()
    };
}

function registrarEstudiante() {
    const data = recolectarDatosEstudiante();

    apiFetch('/apiStudent/Student/PostStudent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(response => response.json().then(body => ({ status: response.status, body })))
        .then(({ status, body }) => {
            if (status === 200) {
                showToast("Estudiante registrado correctamente", "success");
                document.getElementById('form-validation').reset();
            } else {
                showToast('⚠️ ' + (body.error || 'Error al registrar el estudiante'), "info");
            }
        })
        .catch(() => showToast('❌ No se pudo conectar con el servidor'), "info");
}

function editarEstudiante() {
    const data = recolectarDatosEstudiante();

    apiFetch('/apiStudent/Student/UpdateStudent/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(response => {
            if (response.ok) {
                showToast("Estudiante actualizado correctamente", "success");
                document.getElementById('form-validation').reset();
            } else {
                showToast("Error al actualizar el estudiante", "error");
            }
        })
        .catch(() => showToast('❌ No se pudo conectar con el servidor'), "info");
}

function crearCuentaUsuario() {
    const code = document.getElementById('code_student').value.trim();
    if (!code) {
        showToast("Por favor cargue un estudiante primero para crearle su cuenta", "warning");
        return;
    }
    
    const payload = {
        code_student: code
    };
    
    apiFetch('/apiUserCreate/UsuarioCreate/create_student_user/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw new Error(err.error || 'Error al crear usuario'); });
        }
        return res.json();
    })
    .then(data => {
        alert(`🔑 ¡Cuenta de Acceso Creada con éxito!\n\nUsuario (Código Estudiante): ${data.username}\nContraseña Temporal (Aleatoria): ${data.password}\n\nFavor entregar estas credenciales al tutor/estudiante.`);
        
        document.getElementById('btn-create-user').style.display = 'none';
        document.getElementById('user-status-text').style.display = 'block';
        showToast("Cuenta de usuario creada", "success");
    })
    .catch(err => {
        showToast(err.message, "error");
    });
}

function buscarEstudiante() {
    const code = document.getElementById('code_student').value.trim();
    if (!code) {
        showToast("Por favor ingresa un código de estudiante", "info");
        return;
    }

    apiFetch(`/apiStudent/Student/SpecificStudent/?code_student=${encodeURIComponent(code)}`)
        .then(response => response.json().then(data => ({ status: response.status, body: data })))
        .then(({ status, body }) => {
            if (status === 200) {
                document.getElementById('code_student').value = body.code_student;
                document.getElementById('name_student').value = body.name_student;
                document.getElementById('surname_student').value = body.surname_student;
                document.getElementById('birthday_student').value = body.birthday_student;
                document.getElementById('phone_student').value = body.phone_student;
                document.getElementById('email_student').value = body.email_student;
                
                // Actualizar estado del botón de usuario
                const btnUser = document.getElementById('btn-create-user');
                const textUser = document.getElementById('user-status-text');
                if (body.has_user) {
                    btnUser.style.display = 'none';
                    textUser.style.display = 'block';
                } else {
                    btnUser.style.display = 'block';
                    textUser.style.display = 'none';
                }
                
                showToast("Estudiante encontrado", "success");
            } else {
                showToast('❌ ' + (body.error || 'Estudiante no encontrado'), "info");
            }
        })
        .catch(() => showToast('❌ No se pudo conectar con el servidor'), "info");
}