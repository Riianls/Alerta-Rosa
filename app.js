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

  if (sos && label && live && reset) {

    let t0 = 0;
    let raf = 0;
    let active = false;
    let timers = [];

    const setP = (percentage) => {
      sos.style.setProperty("--p", percentage);
    };

    const say = (message) => {
      live.textContent = message;
    };

    const run = () => {
      active = true;
      t0 = 0;

      sos.classList.add("on");

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

      t0 = performance.now();

      raf = requestAnimationFrame(tick);
    };

    const release = () => {
      if (active || !t0) return;

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

})();
