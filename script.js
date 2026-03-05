// Header efeito scroll
window.addEventListener("scroll", function() {
  const header = document.getElementById("header");
  header.classList.toggle("scrolled", window.scrollY > 50);
});

// Fade-in simples ao rolar
const faders = document.querySelectorAll(".fade-in");

const appearOptions = {
  threshold: 0.2
};

const appearOnScroll = new IntersectionObserver(function(entries, observer) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.style.opacity = 1;
    entry.target.style.transform = "translateY(0)";
    observer.unobserve(entry.target);
  });
}, appearOptions);

faders.forEach(fader => {
  fader.style.opacity = 0;
  fader.style.transform = "translateY(40px)";
  fader.style.transition = "all 1s ease";
  appearOnScroll.observe(fader);
});

// LOGIN
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (email === "Jallerson@apollusart.com" && password === "********") {
    localStorage.setItem("adminAuth", "true");
    window.location.href = "dashboard.html";
  } else {
    document.getElementById("error").innerText = "Credenciais inválidas";
  }
}

// LOGOUT
function logout() {
  localStorage.removeItem("adminAuth");
  window.location.href = "login.html";
}

// PROTEÇÃO
if (window.location.pathname.includes("dashboard")) {
  if (!localStorage.getItem("adminAuth")) {
    window.location.href = "login.html";
  }
}

// MOSTRAR SEÇÕES
function showSection(section) {
  document.getElementById("submissionsSection").classList.add("hidden");
  document.getElementById("heroSection").classList.add("hidden");

  if (section === "submissions")
    document.getElementById("submissionsSection").classList.remove("hidden");

  if (section === "hero")
    document.getElementById("heroSection").classList.remove("hidden");
// }

// CARREGAR SUBMISSÕES
// function carregarSubmissoes() {
 //  const lista = document.getElementById("listaSubmissoes");
 //  const contador = document.getElementById("contador");

 //  if (!lista) return;

 //  const submissions = JSON.parse(localStorage.getItem("submissions")) || [];
//   lista.innerHTML = "";
 //  contador.innerText = submissions.length;

//   submissions.forEach((item, index) => {
//     const card = document.createElement("div");
 //    card.classList.add("submission-card");

    card.innerHTML = `
      ${item.foto ? `<img src="${item.foto}">` : ""}
      <h3>${item.nome}</h3>
      <p><strong>Gênero:</strong> ${item.genero}</p>
      <p><strong>Data:</strong> ${item.data}</p>
      <a href="${item.link}" target="_blank">🔗 Ver Link</a>
      ${item.audio ? `<audio controls src="${item.audio}"></audio>` : ""}
      <div class="status ${item.status.toLowerCase()}">${item.status}</div>
      <div style="margin-top:10px;">
        <button onclick="aprovar(${index})">Aprovar</button>
        <button onclick="recusar(${index})">Recusar</button>
      </div>
   `;

//     lista.appendChild(card);
//   });
// }

// function//  aprovar(index) {
//   let submissions = JSON.parse(localStorage.getItem("submissions")) || [];
//   submissions[index].status = "Aprovado";
//   localStorage.setItem("submissions", JSON.stringify(submissions));
//   carregarSubmissoes();
// }

// function recusar(index) {
//   let submissions = JSON.parse(localStorage.getItem("submissions")) || [];
//   submissions[index].status = "Recusado";
//   localStorage.setItem("submissions", JSON.stringify(submissions));
//   carregarSubmissoes();
// }

// window.addEventListener("load", carregarSubmissoes);
// EDITAR HERO
// function updateHero() {
//   const value = document.getElementById("heroInput").value;
//   localStorage.setItem("heroTitle", value);
//  alert("Atualizado!");
//}

//function enviar() {
 // const nome = document.getElementById("nome").value;
 // const genero = document.getElementById("genero").value;
 // const link = document.getElementById("link").value;
 // const mensagem = document.getElementById("mensagem").value;
 // 

  if (!nome || !genero || !link) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  const novaSubmissao = {
    nome,
    genero,
    link,
    mensagem,
    status: "Novo",
    data: new Date().toLocaleDateString()
  };

  let submissions = JSON.parse(localStorage.getItem("submissions")) || [];
  submissions.push(novaSubmissao);

  localStorage.setItem("submissions", JSON.stringify(submissions));

  document.getElementById("sucesso").innerText = "Projeto enviado com sucesso!";
  
  document.getElementById("nome").value = "";
  document.getElementById("genero").value = "";
  document.getElementById("link").value = "";
  document.getElementById("mensagem").value = "";
}

window.addEventListener("load", () => {
  document.body.classList.add("loaded");
});

function toggleTheme() {
  document.body.classList.toggle("light");

  if (document.body.classList.contains("light")) {
    localStorage.setItem("theme", "light");
  } else {
    localStorage.setItem("theme", "dark");
  }
}


const elements = document.querySelectorAll(".fade-in");

window.addEventListener("scroll", () => {
  elements.forEach(el => {
    const position = el.getBoundingClientRect().top;
    const screenPosition = window.innerHeight / 1.2;

    if (position < screenPosition) {
      el.classList.add("visible");
    }
  });
});

function trocarAba(id, elemento) {
  const abas = document.querySelectorAll(".aba");
  const menus = document.querySelectorAll(".menu-item");

  abas.forEach(aba => aba.style.display = "none");
  menus.forEach(menu => menu.classList.remove("active"));

  document.getElementById(id).style.display = "block";
  elemento.classList.add("active");
}

const genero = document.getElementById("genero").value; 
const select = document.querySelector(".select-selected");
const options = document.querySelector(".select-options");
const hiddenInput = document.getElementById("genero");

select.addEventListener("click", () => {
  options.classList.toggle("open");
  select.classList.toggle("active");
});

options.querySelectorAll("div").forEach(option => {
  option.addEventListener("click", () => {
    select.innerText = option.innerText;
    hiddenInput.value = option.dataset.value;
    options.classList.remove("open");
    select.classList.remove("active");
    select.style.color = "white";
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".custom-select")) {
    options.classList.remove("open");
    select.classList.remove("active");
  }

});
