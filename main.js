/* Local Service Insider — interaction layer
   1. scroll-driven 3D postcard flip
   2. section reveals
   3. form validation + async submit
*/
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     1. Postcard: rotate on scroll through the hero
     --------------------------------------------------------- */
  var card = document.getElementById('card');

  if (card && !reduced) {
    var ticking = false;

    function draw() {
      var stage = card.parentElement;
      var box = stage.getBoundingClientRect();
      var vh = window.innerHeight || 1;

      // 0 when the stage centre sits at the bottom of the viewport,
      // 1 when it has travelled to the top.
      var centre = box.top + box.height / 2;
      var p = 1 - centre / vh;
      p = Math.max(0, Math.min(1, p));

      // -16deg resting -> 196deg (fully turned over, plus resting tilt)
      var yaw = -16 + p * 212;
      var pitch = 7 - p * 5;
      var lift = (1 - Math.abs(p - 0.5) * 2) * 14;

      card.style.transform =
        'translateY(' + (-lift).toFixed(2) + 'px) ' +
        'rotateY(' + yaw.toFixed(2) + 'deg) ' +
        'rotateX(' + pitch.toFixed(2) + 'deg)';

      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(draw);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    draw();
  }

  /* ---------------------------------------------------------
     2. Reveals
     --------------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) {
      el.classList.add('is-in');
    });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });

    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     3. Form
     --------------------------------------------------------- */
  var form = document.getElementById('quoteForm');
  if (!form) return;

  var state = document.getElementById('formstate');

  function digits(s) { return (s || '').replace(/\D/g, ''); }

  var rules = {
    name: function (v) { return v.trim().length >= 2; },
    phone: function (v) {
      var d = digits(v);
      return d.length === 10 || (d.length === 11 && d.charAt(0) === '1');
    },
    website: function (v) { return v.trim().length >= 4; }
  };

  function setError(input, on) {
    var msg = form.querySelector('.err[data-for="' + input.id + '"]');
    input.classList.toggle('is-bad', on);
    input.setAttribute('aria-invalid', on ? 'true' : 'false');
    if (msg) msg.classList.toggle('is-on', on);
  }

  function validate() {
    var ok = true;
    Object.keys(rules).forEach(function (id) {
      var input = form.elements[id];
      var good = rules[id](input.value);
      setError(input, !good);
      if (!good) ok = false;
    });
    return ok;
  }

  Object.keys(rules).forEach(function (id) {
    var input = form.elements[id];
    input.addEventListener('blur', function () {
      if (input.value) setError(input, !rules[id](input.value));
    });
    input.addEventListener('input', function () {
      if (input.classList.contains('is-bad') && rules[id](input.value)) {
        setError(input, false);
      }
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    state.textContent = '';

    if (!validate()) {
      var bad = form.querySelector('.is-bad');
      if (bad) bad.focus();
      return;
    }

    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        if (!res.ok) throw new Error('bad response');
        form.reset();
        state.style.color = '#9FE3B0';
        state.textContent = 'Got it. Your sample and quote go out within one business day.';
      })
      .catch(function () {
        state.style.color = '#E4707A';
        state.textContent = 'That didn\u2019t send. Text 000-000-0000 and we\u2019ll set it up directly.';
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
  });
})();
