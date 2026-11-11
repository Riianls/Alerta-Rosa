/* ==========================================
   ALERTA ROSA — JAVASCRIPT
   JavaScript puro, sem dependências
========================================== */

(() => {
  "use strict";

  // IMPORTANTE: substitua pelo e-mail verdadeiro.
  const CONTACT_EMAIL = "alertaroosa@gmail.com";

  const HOLD_MS = 2000;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  /* ======================================
     MENU RESPONSIVO
  ====================================== */

  const burger = $("#burger");
  const menu = $("#menu");

  const setMenu = (open) => {
    if (!burger || !menu) return;

    menu.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute(
      "aria-label",
      open ? "Fechar menu" : "Abrir menu"
    );
  };

  if (burger && menu) {
    burger.addEventListener("click", () => {
      setMenu(!menu.classList.contains("open"));
    });

    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        setMenu(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setMenu(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 950) {
        setMenu(false);
      }
    });
  }

  /* ======================================
     SAÍDA RÁPIDA
  ====================================== */

  const quickExit = () => {
    window.location.replace("https://www.google.com.br");
  };

  const quickExitButton = $("#quickExit");

  if (quickExitButton) {
    quickExitButton.addEventListener("click", (event) => {
      event.preventDefault();
      quickExit();
    });
  }

  let escCount = 0;
  let escTimer;

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.repeat) return;

    escCount++;

    clearTimeout(escTimer);

    escTimer = setTimeout(() => {
      escCount = 0;
    }, 800);

    if (escCount >= 2) {
      quickExit();
    }
  });

  /* ======================================
     DEMONSTRAÇÃO DO BOTÃO SOS
     SIMULAÇÃO: NÃO ENVIA ALERTAS
  ====================================== */

  const sos = $("#sos");
  const label = $("#sosLabel");
  const live = $("#sosLive");
  const reset = $("#demoReset");
  const callBox = $("#demoCall");
  const steps = $$("#demoSteps li");
  const sosStage = $("#sosStage");
  const ringProgress = $("#sosRingProgress");

  if (sos && label && live && reset) {

    let t0 = 0;
    let raf = 0;
    let active = false;
    let timers = [];
    const RING_CIRCUMFERENCE = 741.42;

    const setP = (percentage) => {
      sos.style.setProperty("--p", percentage);
      if (sosStage) {
        sosStage.style.setProperty("--p", percentage);
      }
      if (ringProgress) {
        const offset = RING_CIRCUMFERENCE * (1 - percentage / 100);
        ringProgress.style.strokeDashoffset = offset;
      }
    };

    const say = (message) => {
      live.textContent = message;
    };

    const run = () => {
      active = true;
      t0 = 0;

      sos.classList.remove("holding");
      sos.classList.add("on");
      if (sosStage) {
        sosStage.classList.remove("holding");
        sosStage.classList.add("active");
      }

      label.innerHTML = "Simulado<small>demonstração</small>";

      reset.hidden = false;

      say("Simulação iniciada. Nada está sendo enviado.");

      steps.forEach((li, index) => {
        const timer = setTimeout(() => {
          li.classList.add("done");

          if (index === steps.length - 1 && callBox) {
            callBox.hidden = false;
          }

          say(
            li.textContent +
            (
              index === steps.length - 1
                ? ". Simulação concluída. Nada foi enviado."
                : ""
            )
          );

        }, (index + 1) * 700);

        timers.push(timer);
      });
    };

    const tick = (now) => {
      const progress = Math.max(0, Math.min((now - t0) / HOLD_MS, 1));

      setP(progress * 100);

      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        run();
      }
    };

    const press = () => {
      if (active || t0) return;

      sos.classList.add("holding");
      if (sosStage) sosStage.classList.add("holding");

      t0 = performance.now();

      raf = requestAnimationFrame(tick);
    };

    const release = () => {
      if (active || !t0) return;

      sos.classList.remove("holding");
      if (sosStage) sosStage.classList.remove("holding");

      cancelAnimationFrame(raf);

      t0 = 0;

      setP(0);
    };

    const cancel = () => {
      timers.forEach(clearTimeout);

      timers = [];

      active = false;
      t0 = 0;

      cancelAnimationFrame(raf);

      sos.classList.remove("holding");
      if (sosStage) {
        sosStage.classList.remove("holding");
        sosStage.classList.remove("active");
      }

      steps.forEach((li) => {
        li.classList.remove("done");
      });

      sos.classList.remove("on");

      label.textContent = "SOS";

      setP(0);

      reset.hidden = true;

      if (callBox) callBox.hidden = true;

      say("Simulação cancelada.");
    };

    sos.addEventListener("pointerdown", (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }

      press();
    });

    [
      "pointerup",
      "pointerleave",
      "pointercancel",
      "lostpointercapture",
      "blur"
    ].forEach((eventName) => {
      sos.addEventListener(eventName, release);
    });

    sos.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });

    sos.addEventListener("keydown", (event) => {
      if (
        (event.key === " " || event.key === "Enter") &&
        !event.repeat
      ) {
        event.preventDefault();
        press();
      }
    });

    sos.addEventListener("keyup", (event) => {
      if (event.key === " " || event.key === "Enter") {
        release();
      }
    });

    reset.addEventListener("click", cancel);

    // Efeito Magnetic / Cursor Tilt em 3D (ativo apenas em desktop com mouse)
    if (sosStage && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      let tiltRaf = 0;
      let targetRotX = 0;
      let targetRotY = 0;
      let currentRotX = 0;
      let currentRotY = 0;

      const renderTilt = () => {
        currentRotX += (targetRotX - currentRotX) * 0.14;
        currentRotY += (targetRotY - currentRotY) * 0.14;

        sos.style.setProperty("--tilt-x", `${currentRotX.toFixed(2)}deg`);
        sos.style.setProperty("--tilt-y", `${currentRotY.toFixed(2)}deg`);

        if (Math.abs(targetRotX - currentRotX) > 0.02 || Math.abs(targetRotY - currentRotY) > 0.02) {
          tiltRaf = requestAnimationFrame(renderTilt);
        } else {
          tiltRaf = 0;
        }
      };

      sosStage.addEventListener("mousemove", (event) => {
        const rect = sosStage.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const maxAngle = 15; // até 15 graus
        targetRotY = Math.max(-maxAngle, Math.min(maxAngle, ((x - centerX) / centerX) * maxAngle));
        targetRotX = Math.max(-maxAngle, Math.min(maxAngle, -((y - centerY) / centerY) * maxAngle));

        if (!tiltRaf) {
          tiltRaf = requestAnimationFrame(renderTilt);
        }
      });

      sosStage.addEventListener("mouseleave", () => {
        targetRotX = 0;
        targetRotY = 0;
        if (!tiltRaf) {
          tiltRaf = requestAnimationFrame(renderTilt);
        }
      });
    }
  }

  /* ======================================
     FORMULÁRIO DE CONTATO
     ABRE O APLICATIVO DE E-MAIL
  ====================================== */

  const contactForm = $("#contactForm");

    if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!contactForm.reportValidity()) return;

      const status = $("#formStatus");
      const button = contactForm.querySelector('button[type="submit"]');

      button.disabled = true;
      status.textContent = "Enviando...";

      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new FormData(contactForm)
        });

        const data = await res.json();

        if (res.ok && data.success) {
          contactForm.reset();
          status.textContent = "Mensagem enviada! Obrigado pelo contato.";
        } else {
          throw new Error(data.message || "erro");
        }
      } catch (erro) {
        status.textContent =
          "Não foi possível enviar agora. Tente de novo ou escreva para " +
          CONTACT_EMAIL + ".";
      } finally {
        button.disabled = false;
      }
    });
  }


  /* ======================================
     ROTAS SEGURAS (MAPA INTERATIVO)
  ====================================== */

  const PINS_DATA = {
    1: {
      badge: "DELEGACIA ESPECIALIZADA",
      title: "1ª DEAM - Delegacia de Defesa da Mulher",
      address: "Av. Central da Paz, 1020 — Centro",
      hours: "24 Horas Ininterruptas",
      phone: "Ligue 180 / (11) 3224-5000",
      desc: "Atendimento policial humanizado, registro prioritário de Boletim de Ocorrência, requerimento imediato de Medida Protetiva de Urgência e salas privativas de acolhimento.",
      tel: "180",
      routeId: "route1",
      targetX: -380,
      targetY: -150
    },
    2: {
      badge: "HOSPITAL & SAÚDE",
      title: "Hospital Materno de Referência",
      address: "Rua das Acácias, 450 — Bairro Sul",
      hours: "Pronto-Socorro 24h",
      phone: "Ligue 192 / (11) 3456-7890",
      desc: "Atendimento médico prioritário com Protocolo Lilás, profilaxia emergencial de ISTs, apoio psicológico e assistentes sociais de plantão.",
      tel: "192",
      routeId: "route3",
      targetX: -220,
      targetY: -420
    },
    3: {
      badge: "PONTO DE ACOLHIMENTO",
      title: "Ponto de Acolhimento Comunitário Rosa",
      address: "Alameda das Flores, 88 — Vila Rosa",
      hours: "Seg a Sáb: 07h às 22h",
      phone: "(11) 98765-4321",
      desc: "Rede solidária de apoio local com Guardiãs voluntárias, espaço seguro para espera, telefone de apoio, Wi-Fi aberto e ponto de recarga de celular.",
      tel: "+5511987654321",
      routeId: "route2",
      targetX: -760,
      targetY: -280
    },
    4: {
      badge: "APOIO JURÍDICO & SOCIAL",
      title: "Centro de Referência da Mulher (CRM)",
      address: "Rua da Solidariedade, 310 — Zona Oeste",
      hours: "Seg a Sex: 08h às 18h",
      phone: "Ligue 180 / (11) 3105-1200",
      desc: "Acompanhamento social e jurídico gratuito para mulheres vítimas de violência, psicólogas especializadas e articulação com abrigos sigilosos.",
      tel: "180",
      routeId: "route1",
      targetX: -30,
      targetY: -220
    },
    5: {
      badge: "BASE COMUNITÁRIA 24H",
      title: "Base Comunitária Segura 24h",
      address: "Praça do Encontro, s/n — Zona Sul",
      hours: "24 Horas",
      phone: "Ligue 190 / (11) 3320-1000",
      desc: "Ponto de apoio iluminado com totem de emergência direta, botão de pânico municipal e presença contínua de patrulha comunitária.",
      tel: "190",
      routeId: "route4",
      targetX: -540,
      targetY: -450
    },
    6: {
      badge: "HOSPITAL DE EMERGÊNCIA",
      title: "Pronto-Socorro Municipal Zona Leste",
      address: "Av. do Trabalhador, 1200 — Zona Leste",
      hours: "Pronto Atendimento 24h",
      phone: "Ligue 192 / (11) 2290-4000",
      desc: "Unidade de saúde municipal com equipe multidisciplinar e acolhimento especializado a casos de vulnerabilidade e agressão.",
      tel: "192",
      routeId: "route2",
      targetX: -860,
      targetY: -100
    }
  };

  const mapWrapper = $("#mapWrapper");
  const mapContent = $("#mapContent");
  const mapPopover = $("#mapPopover");
  const popoverBadge = $("#popoverBadge");
  const popoverTitle = $("#popoverTitle");
  const popoverAddress = $("#popoverAddress");
  const popoverHours = $("#popoverHours");
  const popoverPhone = $("#popoverPhone");
  const popoverDesc = $("#popoverDesc");
  const popoverCallBtn = $("#popoverCallBtn");
  const popoverRouteBtn = $("#popoverRouteBtn");
  const popoverClose = $("#popoverClose");
  const mapRoutesSvg = $("#mapRoutesSvg");

  if (mapWrapper && mapContent) {
    let scale = 1;
    let curX = -350;
    let curY = -220;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let activePinId = null;

    const applyTransform = () => {
      // Limites do arrasto
      const minX = -1000;
      const maxX = 100;
      const minY = -550;
      const maxY = 100;
      curX = Math.max(minX, Math.min(maxX, curX));
      curY = Math.max(minY, Math.min(maxY, curY));
      mapContent.style.transform = `translate(${curX}px, ${curY}px) scale(${scale})`;
    };

    applyTransform();

    // Mouse drag
    mapWrapper.addEventListener("mousedown", (e) => {
      if (e.target.closest(".map-controls") || e.target.closest(".map-popover")) return;
      isDragging = true;
      startX = e.clientX - curX;
      startY = e.clientY - curY;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      curX = e.clientX - startX;
      curY = e.clientY - startY;
      applyTransform();
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    // Touch drag (mobile)
    mapWrapper.addEventListener("touchstart", (e) => {
      if (e.target.closest(".map-controls") || e.target.closest(".map-popover")) return;
      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - curX;
        startY = e.touches[0].clientY - curY;
      }
    }, { passive: true });

    mapWrapper.addEventListener("touchmove", (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      curX = e.touches[0].clientX - startX;
      curY = e.touches[0].clientY - startY;
      applyTransform();
    }, { passive: true });

    mapWrapper.addEventListener("touchend", () => {
      isDragging = false;
    });

    // Scroll wheel zoom
    mapWrapper.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      scale = Math.max(0.65, Math.min(2.0, scale + delta));
      applyTransform();
    }, { passive: false });

    // Botões de Zoom e Reset
    const btnZoomIn = $("#mapZoomIn");
    const btnZoomOut = $("#mapZoomOut");
    const btnReset = $("#mapReset");
    const btnToggleRoutes = $("#mapToggleRoutes");

    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => {
        scale = Math.min(2.0, scale + 0.2);
        applyTransform();
      });
    }

    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => {
        scale = Math.max(0.65, scale - 0.2);
        applyTransform();
      });
    }

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        scale = 1;
        curX = -350;
        curY = -220;
        applyTransform();
        if (mapPopover) mapPopover.classList.remove("open");
        $$(".route-line").forEach((p) => p.classList.remove("highlighted"));
        $$(".map-pin").forEach((p) => p.classList.remove("active-pin"));
      });
    }

    if (btnToggleRoutes && mapRoutesSvg) {
      btnToggleRoutes.addEventListener("click", () => {
        btnToggleRoutes.classList.toggle("active");
        mapRoutesSvg.classList.toggle("hidden-routes");
      });
    }

    // Clique nos Pins
    const openPinDetails = (id) => {
      const data = PINS_DATA[id];
      if (!data || !mapPopover) return;

      activePinId = id;
      popoverBadge.textContent = data.badge;
      popoverTitle.textContent = data.title;
      popoverAddress.textContent = data.address;
      popoverHours.textContent = data.hours;
      popoverPhone.textContent = data.phone;
      popoverDesc.textContent = data.desc;
      popoverCallBtn.setAttribute("href", `tel:${data.tel}`);

      $$(".map-pin").forEach((p) => p.classList.remove("active-pin"));
      const targetPin = $(`.map-pin[data-id="${id}"]`);
      if (targetPin) targetPin.classList.add("active-pin");

      mapPopover.classList.add("open");
    };

    $$(".map-pin").forEach((pin) => {
      pin.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = pin.getAttribute("data-id");
        openPinDetails(id);
      });

      pin.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const id = pin.getAttribute("data-id");
          openPinDetails(id);
        }
      });
    });

    if (popoverClose && mapPopover) {
      popoverClose.addEventListener("click", () => {
        mapPopover.classList.remove("open");
        $$(".route-line").forEach((p) => p.classList.remove("highlighted"));
        $$(".map-pin").forEach((p) => p.classList.remove("active-pin"));
      });
    }

    if (popoverRouteBtn) {
      popoverRouteBtn.addEventListener("click", () => {
        if (!activePinId) return;
        const data = PINS_DATA[activePinId];
        if (data && data.routeId) {
          $$(".route-line").forEach((p) => p.classList.remove("highlighted"));
          const route = $(`#${data.routeId}`);
          if (route) route.classList.add("highlighted");

          // Centraliza suavemente no ponto
          scale = 1.25;
          curX = data.targetX;
          curY = data.targetY;
          applyTransform();
        }
      });
    }

    // Filtros de Categoria do Mapa
    $$(".map-filter-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".map-filter-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const filter = btn.getAttribute("data-filter");

        $$(".map-pin").forEach((pin) => {
          if (filter === "all") {
            pin.classList.remove("hidden-pin");
          } else if (filter === "deam") {
            pin.classList.toggle("hidden-pin", !pin.classList.contains("pin-deam"));
          } else if (filter === "saude") {
            pin.classList.toggle("hidden-pin", !pin.classList.contains("pin-saude"));
          } else if (filter === "apoio") {
            pin.classList.toggle("hidden-pin", !pin.classList.contains("pin-apoio"));
          }
        });
      });
    });
  }

  /* ======================================
     BIBLIOTECA (NETFLIX CAROUSEL & MODAL)
  ====================================== */

  const BOOKS_DATA = [
    {
      title: "Mulheres que Correm com os Lobos",
      author: "Clarissa Pinkola Estés",
      tag: "CLÁSSICO",
      cover: "img/Mulheres.jpg",
      cat: "classicos",
      synopsis: "Obra essencial da psicologia analítica que resgata a 'Mulher Selvagem', a essência intuitiva, criativa e instintiva das mulheres sufocadas pela opressão patriarcal. Através da interpretação de mitos e contos ancestrais, a autora ensina a identificar predadores emocionais, estabelecer limites saudáveis e reconectar-se com a força de sua matilha interior.",
      quote: "Não devemos ter medo de investigar os segredos mais profundos: a mulher forte é aquela que ousa olhar de perto a própria verdade."
    },
    {
      title: "Sejamos Todos Feministas",
      author: "Chimamanda Ngozi Adichie",
      tag: "DIREITOS",
      cover: "img/Sejamos.jpg",
      cat: "direitos",
      synopsis: "Adaptação lúcida, direta e transformadora do aclamado discurso da escritora nigeriana. Com humor e sensibilidade, Adichie desconstrói os estereótipos sobre o feminismo e demonstra que a igualdade de gênero é uma necessidade urgente para mulheres e homens, apontando caminhos práticos para criar uma sociedade livre de violência e opressão.",
      quote: "A pessoa que aprendeu a se respeitar e a respeitar os outros nunca aceitará a violência ou o silenciamento como normais."
    },
    {
      title: "O Mito da Beleza",
      author: "Naomi Wolf",
      tag: "SOCIEDADE",
      cover: "img/Mito.png",
      cat: "direitos",
      synopsis: "Uma investigação contundente sobre como a imposição de padrões estéticos irreais funciona como mecanismo de controle social e econômico contra a emancipação feminina. A autora expõe a indústria da insegurança e mostra como recuperar a soberania sobre o próprio corpo é um passo primordial de libertação.",
      quote: "Uma cultura obcecada pela magreza e pela juventude feminina não tem obsessão por beleza: tem obsessão por obediência."
    },
    {
      title: "O Segundo Sexo",
      author: "Simone de Beauvoir",
      tag: "CLÁSSICO",
      cover: "img/Segundo.jpg",
      cat: "classicos",
      synopsis: "Marco fundamental do pensamento ocidental contemporâneo. Simone de Beauvoir disseca a condição feminina sob os prismas da biologia, história, psicanálise e filosofia existencialista, desmontando mitos deterministas com a célebre constatação de que 'não se nasce mulher: torna-se mulher'.",
      quote: "Não se nasce mulher: torna-se mulher. E nenhuma sociedade é verdadeiramente livre enquanto metade da população viver sob ameaça."
    },
    {
      title: "Eu Sei Por Que o Pássaro Canta na Gaiola",
      author: "Maya Angelou",
      tag: "VOZES",
      cover: "img/Passaro.jpg",
      cat: "vozes",
      synopsis: "Autobiografia monumental que acompanha a infância de Maya Angelou no sul segregado dos EUA. Ao narrar traumas de racismo e violência sexual na infância, a autora revela como a literatura, a sororidade entre mulheres negras e a coragem transformaram a dor em poesia, ativismo e liberdade.",
      quote: "Não há agonia maior do que guardar uma história não contada dentro de si. A sua voz é seu maior escudo e seu maior poder."
    },
    {
      title: "Extraordinárias: Mulheres que Revolucionaram o Brasil",
      author: "Duda Porto de Souza & Aryane Cararo",
      tag: "HISTÓRIA",
      cover: "img/Extra.jpg",
      cat: "vozes",
      synopsis: "Um resgate histórico fascinante e ricamente documentado sobre dezenas de mulheres brasileiras de todas as etnias e regiões — guerreiras indígenas, cientistas, líderes quilombolas e ativistas políticas — que lutaram bravamente por cidadania, justiça e direitos humanos no Brasil.",
      quote: "Conhecer as mulheres corajosas que vieram antes de nós é lembrar que a resistência e o protagonismo também são heranças brasileiras."
    },
    {
      title: "A Cor Púrpura",
      author: "Alice Walker",
      tag: "LITERATURA",
      cover: "img/Cor.jpg",
      cat: "vozes",
      synopsis: "Clássico vencedor do Prêmio Pulitzer que relata a comovente trajetória de Celie no interior dos Estados Unidos. Através de cartas e da descoberta da solidariedade feminina com Shug Avery, a obra retrata a superação de décadas de abuso doméstico e a conquista definitiva do amor-próprio e da dignidade.",
      quote: "Acho que irrita a Deus se você passar pela cor púrpura em algum campo e não notar. A vida e a liberdade são sagradas."
    },
    {
      title: "Quarto de Despejo: Diário de uma Favelada",
      author: "Carolina Maria de Jesus",
      tag: "MEMÓRIAS",
      cover: "img/Despejo.jpg",
      cat: "vozes",
      synopsis: "O diário real e poético de uma mulher negra e mãe solo catadora de papel na favela do Canindé em São Paulo. Um dos documentos mais expressivos da literatura nacional sobre sobrevivência, luta contra a invisibilidade e a força inabalável de uma mãe pela proteção de seus filhos.",
      quote: "Quem tem fome não tem sossego. Escrevo para que o mundo saiba que nós existimos, sentimos e exigimos dignidade."
    },
    {
      title: "Calibã e a Bruxa",
      author: "Silvia Federici",
      tag: "CLÁSSICO",
      cover: "img/Bruxa.jpg",
      cat: "classicos",
      synopsis: "Pesquisa histórica rigorosa que investiga a caça às bruxas na transição do feudalismo para o capitalismo, demonstrando como a violência institucional sobre os corpos femininos e a destruição das redes comunitárias de mulheres foram essenciais para o controle econômico e reprodutivo.",
      quote: "O corpo da mulher foi o primeiro território a ser colonizado. Reconstruir a rede de apoio coletivo é nosso ato de autonomia."
    },
    {
      title: "Mulheres, Raça e Classe",
      author: "Angela Davis",
      tag: "DIREITOS",
      cover: "img/Classe.jpg",
      cat: "direitos",
      synopsis: "Obra seminal sobre a indissociabilidade entre as lutas de gênero, raça e classe. Angela Davis analisa com precisão histórica os movimentos abolicionistas e sufragistas, provando que a verdadeira libertação só ocorre quando as mais vulneráveis e marginalizadas são colocadas no centro da proteção social.",
      quote: "Quando a mulher negra se movimenta, toda a estrutura da sociedade se movimenta com ela. Proteger as mais vulneráveis liberta a todos."
    }
  ];

  const libTrack = $("#libTrack");
  const libPrev = $("#libPrev");
  const libNext = $("#libNext");
  const libProgressBar = $("#libProgressBar");
  const libSearch = $("#libSearch");
  const libToast = $("#libToast");
  const libToastMsg = $("#libToastMsg");

  // Rolar Carrossel
  if (libTrack && libPrev && libNext) {
    const updateProgress = () => {
      const maxScroll = libTrack.scrollWidth - libTrack.clientWidth;
      if (maxScroll <= 0) {
        if (libProgressBar) libProgressBar.style.width = "100%";
        return;
      }
      const pct = Math.max(10, Math.min(100, (libTrack.scrollLeft / maxScroll) * 100));
      if (libProgressBar) libProgressBar.style.width = `${pct}%`;
    };

    libPrev.addEventListener("click", () => {
      const amount = libTrack.clientWidth * 0.75;
      libTrack.scrollBy({ left: -amount, behavior: "smooth" });
    });

    libNext.addEventListener("click", () => {
      const amount = libTrack.clientWidth * 0.75;
      libTrack.scrollBy({ left: amount, behavior: "smooth" });
    });

    libTrack.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
  }

  // Toast
  let toastTimer;
  const showToast = (message) => {
    if (!libToast || !libToastMsg) return;
    libToastMsg.textContent = message;
    libToast.classList.add("open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      libToast.classList.remove("open");
    }, 3500);
  };

  // Download do Guia Educativo
  const downloadBookGuide = (index) => {
    const book = BOOKS_DATA[index];
    if (!book) return;

    const content = `=====================================================
ALERTA ROSA — GUIA DE LEITURA & EMPODERAMENTO
Obra: ${book.title}
Autoria: ${book.author}
Categoria: ${book.tag}
=====================================================

SOBRE A OBRA:
${book.synopsis}

CITAÇÃO EM DESTAQUE:
${book.quote}

POR QUE ESTA LEITURA SALVA VIDAS:
O conhecimento sobre direitos, a quebra do silêncio e o fortalecimento
da autoestima são pilares fundamentais da proteção e da autonomia feminina.
Compartilhe esta leitura com outras mulheres da sua rede de confiança.

CANAIS OFICIAIS DE APOIO:
- Em perigo imediato: Ligue 190 (Polícia Militar)
- Central de Atendimento à Mulher: Ligue 180 (Gratuito e anônimo)
- Direitos Humanos: Ligue 100

=====================================================
Alerta Rosa — Proteção, Privacidade e Acolhimento
Site oficial: alertarosa.vertraweb.app
=====================================================
`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Guia-${book.title.replace(/[^a-zA-Z0-9]/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`✓ Guia baixado: "${book.title}"`);
  };

  // Modal do Livro
  const bookModalBackdrop = $("#bookModalBackdrop");
  const modalBookCover = $("#modalBookCover");
  const modalBookTag = $("#modalBookTag");
  const modalBookTitle = $("#modalBookTitle");
  const modalBookAuthor = $("#modalBookAuthor");
  const modalBookSynopsis = $("#modalBookSynopsis");
  const modalBookQuote = $("#modalBookQuote");
  const modalDownloadBtn = $("#modalDownloadBtn");
  const bookModalClose = $("#bookModalClose");
  const modalCloseBtn = $("#modalCloseBtn");
  let currentModalIndex = 0;

  const openBookModal = (index) => {
    const book = BOOKS_DATA[index];
    if (!book || !bookModalBackdrop) return;

    currentModalIndex = index;
    modalBookCover.src = book.cover;
    modalBookCover.alt = `Capa de ${book.title}`;
    modalBookTag.textContent = book.tag;
    modalBookTitle.textContent = book.title;
    modalBookAuthor.textContent = `Por ${book.author}`;
    modalBookSynopsis.textContent = book.synopsis;
    modalBookQuote.textContent = `"${book.quote}"`;

    bookModalBackdrop.classList.add("open");
    bookModalBackdrop.setAttribute("aria-hidden", "false");
  };

  const closeBookModal = () => {
    if (!bookModalBackdrop) return;
    bookModalBackdrop.classList.remove("open");
    bookModalBackdrop.setAttribute("aria-hidden", "true");
  };

  if (bookModalClose) bookModalClose.addEventListener("click", closeBookModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeBookModal);

  if (bookModalBackdrop) {
    bookModalBackdrop.addEventListener("click", (e) => {
      if (e.target === bookModalBackdrop) closeBookModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && bookModalBackdrop && bookModalBackdrop.classList.contains("open")) {
      closeBookModal();
    }
  });

  if (modalDownloadBtn) {
    modalDownloadBtn.addEventListener("click", () => {
      downloadBookGuide(currentModalIndex);
    });
  }

  // Cliques nos Botões dos Cards de Livro
  $$(".lib-btn-info").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      openBookModal(idx);
    });
  });

  $$(".lib-btn-dl").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.getAttribute("data-index"), 10);
      downloadBookGuide(idx);
    });
  });

  // Busca em Tempo Real
  if (libSearch) {
    libSearch.addEventListener("input", () => {
      const query = libSearch.value.trim().toLowerCase();
      $$(".lib-card").forEach((card) => {
        const idx = parseInt(card.getAttribute("data-index"), 10);
        const book = BOOKS_DATA[idx];
        if (!book) return;

        const match =
          book.title.toLowerCase().includes(query) ||
          book.author.toLowerCase().includes(query) ||
          book.synopsis.toLowerCase().includes(query) ||
          book.tag.toLowerCase().includes(query);

        card.classList.toggle("hidden-card", !match);
      });
    });
  }

  // Filtros de Categoria da Biblioteca
  $$(".lib-cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".lib-cat-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.getAttribute("data-cat");

      $$(".lib-card").forEach((card) => {
        if (cat === "all") {
          card.classList.remove("hidden-card");
        } else {
          card.classList.toggle("hidden-card", card.getAttribute("data-cat") !== cat);
        }
      });
    });
  });

})();
