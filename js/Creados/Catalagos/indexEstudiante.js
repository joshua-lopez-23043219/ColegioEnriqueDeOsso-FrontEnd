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

    // Se enganchan solo los botones que EXISTEN. Antes se enganchaban tres a
    // ciegas y dos no estaban en el HTML: `null.addEventListener` reventaba
    // aqui mismo y se llevaba por delante lo que viniera despues.
    const enganchar = (id, fn) => {
        const boton = document.getElementById(id);
        if (boton) boton.addEventListener('click', fn);
    };
    enganchar('edit-btn', editarEstudiante);
    cargarGruposEnFicha();
    enganchar('btn-create-user', crearCuentaUsuario);
});

// --------------------------------------------------------------------------
// LO QUE ESTABA ROTO
// Este script se escribio contra una version vieja de la pagina: leia y
// escribia en `name_student`, `surname_student`, `phone_student` y
// `email_student`, campos que el formulario ya NO tiene (ahora el nombre va
// partido en cuatro). `document.getElementById(...).value` sobre null lanza
// TypeError, asi que ni la busqueda ni la edicion funcionaban: la pantalla
// entera estaba muerta.
//
// Ahora se trabaja con los campos que existen, y con ayudantes que toleran
// que falte alguno: una pantalla no deberia caerse entera por un input que
// alguien quito del HTML.
// --------------------------------------------------------------------------
function _leer(id) {
    const campo = document.getElementById(id);
    return campo ? String(campo.value || '').trim() : '';
}

function _escribir(id, valor) {
    const campo = document.getElementById(id);
    if (campo) campo.value = (valor === null || valor === undefined) ? '' : valor;
}

// Los campos de la ficha que esta pantalla puede corregir. El codigo NO va
// aqui: identifica al estudiante, no es un dato a editar.
const CAMPOS_FICHA = [
    'first_name', 'second_name', 'first_lastname', 'second_lastname',
    'birthday_student', 'gender', 'nationality', 'religion',
    'weight', 'height', 'health_condition', 'address', 'siblings_info',
    'phone_student', 'email_student'
];

function recolectarDatosEstudiante() {
    const datos = { code_student: _leer('code_student') };
    CAMPOS_FICHA.forEach(campo => {
        const valor = _leer(campo);
        if (valor) datos[campo] = valor;
    });

    // El modelo guarda el nombre partido en cuatro Y junto en dos. Las
    // pantallas de notas, acta y boletin leen los juntos, asi que hay que
    // recomponerlos o el cambio no se ve en ningun lado.
    const nombre = [_leer('first_name'), _leer('second_name')].filter(Boolean).join(' ');
    const apellido = [_leer('first_lastname'), _leer('second_lastname')].filter(Boolean).join(' ');
    if (nombre) datos.name_student = nombre;
    if (apellido) datos.surname_student = apellido;

    const grupo = _leer('group_id');
    if (grupo) datos.group = grupo;

    return datos;
}

// El grupo es un selector: sin cargarlo, quedaba siempre vacio y editar la
// ficha borraba la asignacion de grupo.
function cargarGruposEnFicha() {
    const selector = document.getElementById('group_id');
    if (!selector) return;
    apiFetch('/apiGroup/Group/ListaGrupos/')
        .then(r => r.ok ? r.json() : Promise.reject(new Error('No se pudieron cargar los grupos')))
        .then(grupos => {
            grupos.forEach(g => {
                const op = document.createElement('option');
                op.value = g.id;
                op.textContent = `${g.code_group} - ${g.level_group} (${g.section_group})`;
                selector.appendChild(op);
            });
        })
        .catch(err => showToast(err.message, 'error'));
}

// El alta de fichas se hace SOLO desde Matricula, que crea el estudiante
// junto con su tutor y su matricula en una transaccion. Crearla aqui dejaba
// fichas sueltas sin matricula, que no salen en ninguna lista y que despues
// nadie sabe de donde salieron. El servidor tambien lo rechaza.

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
        
        const btn = document.getElementById('btn-create-user');
        const txt = document.getElementById('user-status-text');
        if (btn) btn.style.display = 'none';
        if (txt) txt.style.display = 'block';
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
                _escribir('code_student', body.code_student);
                CAMPOS_FICHA.forEach(campo => _escribir(campo, body[campo]));
                _escribir('student_id', body.id);
                _escribir('group_id', body.group || '');

                // El boton de crear cuenta solo existe en algunas versiones
                // de la pagina; se toca solo si esta.
                const btnUser = document.getElementById('btn-create-user');
                const textUser = document.getElementById('user-status-text');
                if (btnUser) btnUser.style.display = body.has_user ? 'none' : 'block';
                if (textUser) textUser.style.display = body.has_user ? 'block' : 'none';

                showToast("Estudiante encontrado", "success");
            } else {
                showToast('❌ ' + (body.error || 'Estudiante no encontrado'), "info");
            }
        })
        .catch(() => showToast('❌ No se pudo conectar con el servidor'), "info");
}