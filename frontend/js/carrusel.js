const testimonios = [
    { texto: "Excelente profesional, me ayudó en un caso muy complicado. Totalmente recomendado.", autor: "Cliente anónimo" },
    { texto: "Muy atento y resolvió mi caso rápidamente. Un abogado excepcional.", autor: "María R." },
    { texto: "Confianza y profesionalismo. Siempre disponible para resolver dudas.", autor: "Carlos L." }
];

let testimonioActual = 0;

function mostrarTestimonio(index) {
    const testimonio = testimonios[index];
    const contenedor = document.querySelector('.testimonio-activo');
    if (contenedor) {
        contenedor.innerHTML = `<p>"${testimonio.texto}"</p><h4>- ${testimonio.autor}</h4>`;
    }
}

function siguienteTestimonio() {
    testimonioActual = (testimonioActual + 1) % testimonios.length;
    mostrarTestimonio(testimonioActual);
}

setInterval(siguienteTestimonio, 5000);
mostrarTestimonio(0);