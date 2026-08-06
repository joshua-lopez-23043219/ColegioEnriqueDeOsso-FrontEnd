const searchInput = document.getElementById("faq-search");

function limpiarResaltado(texto) {
  return texto.replace(/<mark>(.*?)<\/mark>/g, "$1");
}

function filtrarPreguntas() {
  const filtro = searchInput.value.toLowerCase();
  const items = document.querySelectorAll(".faq-item");
  let hayCoincidencia = false;

  items.forEach((item) => {
    const preguntaSpan = item.querySelector(".faq-question .question-text");
    const answer = item.querySelector(".faq-answer");
    const textoOriginal = limpiarResaltado(preguntaSpan.innerHTML);
    const textoPlano = textoOriginal.toLowerCase();

    if (filtro === "") {
      item.style.display = "block";
      preguntaSpan.innerHTML = textoOriginal;
      answer.classList.remove("open");
      answer.style.maxHeight = null;
    } else if (textoPlano.includes(filtro)) {
      item.style.display = "block";
      hayCoincidencia = true;

      const inicio = textoPlano.indexOf(filtro);
      const fin = inicio + filtro.length;
      const antes = textoOriginal.substring(0, inicio);
      const coincide = textoOriginal.substring(inicio, fin);
      const despues = textoOriginal.substring(fin);

      preguntaSpan.innerHTML = `${antes}<mark>${coincide}</mark>${despues}`;

      // Mostrar respuesta
      answer.classList.add("open");
      answer.style.maxHeight = answer.scrollHeight + "px";
    } else {
      item.style.display = "none";
      preguntaSpan.innerHTML = textoOriginal;
      answer.classList.remove("open");
      answer.style.maxHeight = null;
    }
  });

  // Mensaje "no hay resultados"
  const mensajeNo = document.getElementById("no-result-message");
  if (!hayCoincidencia && filtro.trim() !== "") {
    if (!mensajeNo) {
      const mensaje = document.createElement("p");
      mensaje.id = "no-result-message";
      mensaje.textContent = "No se encontraron coincidencias.";
      mensaje.style.textAlign = "center";
      mensaje.style.color = "gray";
      mensaje.style.marginTop = "15px";
      searchInput.insertAdjacentElement("afterend", mensaje);
    }
  } else if (mensajeNo) {
    mensajeNo.remove();
  }
}

// Eventos
searchInput.addEventListener("input", filtrarPreguntas);
searchInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    e.preventDefault();
    filtrarPreguntas();
  }
});
document.querySelectorAll(".faq-question").forEach((button) => {
  button.addEventListener("click", function () {
    const answer = this.nextElementSibling;
    if (answer.classList.contains("open")) {
      answer.classList.remove("open");
      answer.style.maxHeight = null;
    } else {
      answer.classList.add("open");
      answer.style.maxHeight = answer.scrollHeight + "px";
    }
  });
});