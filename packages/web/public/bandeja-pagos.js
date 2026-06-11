/* ==========================================================================
   ABITIA — BANDEJA DE VERIFICACIÓN DE PAGOS — Controller (Vanilla JS)
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     CONSTANTS & STATE
     ------------------------------------------------------------------------ */
  var API_BASE = '/api';
  var STATE = {
    token: localStorage.getItem('abitia_token') || null,
    user: JSON.parse(localStorage.getItem('abitia_user') || 'null'),
    condominio: JSON.parse(localStorage.getItem('abitia_condominio') || 'null'),
    syncing: false,
    propiedades: new Map(),
  };

  /* ------------------------------------------------------------------------
     DOM REFERENCES
     ------------------------------------------------------------------------ */
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    loginModal:    $('loginModal'),
    loginForm:     $('loginForm'),
    loginEmail:    $('loginEmail'),
    loginPassword: $('loginPassword'),
    loginError:    $('loginError'),
    pagosBody:     $('pagosBody'),
    recordCount:   $('recordCount'),
    statusMsg:     $('statusMsg'),
    lastSync:      $('lastSync'),
    userLabel:     $('userLabel'),
    refreshBtn:    $('refreshBtn'),
    syncBtn:       $('syncBtn'),
    toastContainer:$('toastContainer'),
  };

  /* ------------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', function () {
    els.loginForm.addEventListener('submit', handleLogin);
    els.refreshBtn.addEventListener('click', function () { loadBandeja(); });
    
    if (els.syncBtn) {
      els.syncBtn.addEventListener('click', function () {
        if (STATE.syncing) return;
        STATE.syncing = true;
        els.syncBtn.classList.add('syncing');
        setStatus('Sincronizando con el servidor contable…');
        setTimeout(function () {
          fetch(API_BASE + '/propiedades', { headers: authHeaders() })
            .then(function (res) {
              if (res.status === 401) { logout(); throw new Error('Sesión expirada.'); }
              return res.json();
            })
            .then(function (props) {
              STATE.propiedades.clear();
              if (Array.isArray(props)) {
                for (var i = 0; i < props.length; i++) {
                  STATE.propiedades.set(props[i].IdPropiedad, props[i].Codigo_Nro);
                }
              }
              return fetch(API_BASE + '/pagos/bandeja', { headers: authHeaders() });
            })
            .then(function (res) {
              if (res.status === 401) { logout(); throw new Error('Sesión expirada.'); }
              return res.json().then(function (data) { return { ok: res.ok, data: data }; });
            })
            .then(function (result) {
              if (!result.ok) throw new Error(result.data.error || 'Error al cargar la bandeja');
              renderTable(result.data);
              els.lastSync.textContent = 'Actualizado: ' + formatTime(new Date());
              toast('Sincronización finalizada con éxito.', 'success');
              setStatus('');
            })
            .catch(function (err) {
              setStatus('');
              if (err.message === 'Sesión expirada.') return;
              toast(err.message, 'error');
            })
            .finally(function () {
              STATE.syncing = false;
              els.syncBtn.classList.remove('syncing');
            });
        }, 800);
      });
    }

    if (STATE.token) {
      updateUserUI();
      hideLogin();
      loadBandeja();
    } else {
      showLogin();
    }
  });

  /* ------------------------------------------------------------------------
     AUTH
     ------------------------------------------------------------------------ */
  function showLogin() {
    els.loginModal.classList.add('active');
    els.loginEmail.focus();
    els.pagosBody.innerHTML = '<tr class="empty-row"><td colspan="7">Inicie sesión para cargar la bandeja de pagos.</td></tr>';
    els.recordCount.textContent = '—';
  }

  function hideLogin() {
    els.loginModal.classList.remove('active');
    els.loginError.classList.remove('active');
    els.loginError.textContent = '';
    els.loginForm.reset();
  }

  function updateUserUI() {
    if (STATE.user && STATE.condominio) {
      els.userLabel.textContent = STATE.user.email + ' | ' + STATE.condominio.nombreCondominio;
    } else if (STATE.user) {
      els.userLabel.textContent = STATE.user.email;
    } else {
      els.userLabel.textContent = '—';
    }
  }

  function handleLogin(e) {
    e.preventDefault();
    var email = els.loginEmail.value.trim();
    var password = els.loginPassword.value;

    if (!email || !password) {
      els.loginError.textContent = 'Email y contraseña requeridos.';
      els.loginError.classList.add('active');
      return;
    }

    els.loginError.classList.remove('active');
    setStatus('Autenticando…');

    fetch(API_BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok) {
          throw new Error(result.data.error || 'Credenciales inválidas');
        }
        return result.data;
      })
      .then(function (data) {
        STATE.token = data.token;
        STATE.user = { email: data.email, nombre: data.nombre, idUsuario: data.idUsuario };
        localStorage.setItem('abitia_token', STATE.token);
        localStorage.setItem('abitia_user', JSON.stringify(STATE.user));

        if (data.singleCondominio && data.condominio) {
          STATE.condominio = data.condominio;
          localStorage.setItem('abitia_condominio', JSON.stringify(STATE.condominio));
          redirectToTenant(data.condominio.slug);
        } else if (!data.singleCondominio && data.condominios && data.condominios.length > 0) {
          var adminCondominios = data.condominios.filter(function (c) {
            return c.rol === 1 || c.rol === 2;
          });
          if (adminCondominios.length > 0) {
            STATE.condominio = adminCondominios[0];
            localStorage.setItem('abitia_condominio', JSON.stringify(STATE.condominio));
            redirectToTenant(STATE.condominio.slug);
          } else {
            throw new Error('Su usuario no tiene rol de administrador en ningún condominio.');
          }
        } else {
          throw new Error('No se encontraron condominios asignados.');
        }
      })
      .catch(function (err) {
        els.loginError.textContent = err.message;
        els.loginError.classList.add('active');
        setStatus('');
      });
  }

  function redirectToTenant(slug) {
    if (!slug) return;
    var hostname = window.location.hostname;
    var isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
    var expected = slug + (isLocal ? '.localhost' : '.abitia.app');

    if (hostname === expected) {
      updateUserUI();
      hideLogin();
      loadBandeja();
      return;
    }
    setStatus('Redirigiendo al panel del condominio…');
    setTimeout(function () {
      window.location.href = window.location.protocol + '//' + expected + ':' + window.location.port + window.location.pathname;
    }, 400);
  }

  function logout() {
    STATE.token = null;
    STATE.user = null;
    STATE.condominio = null;
    localStorage.removeItem('abitia_token');
    localStorage.removeItem('abitia_user');
    localStorage.removeItem('abitia_condominio');
    els.pagosBody.innerHTML = '<tr class="empty-row"><td colspan="7">Inicie sesión para cargar la bandeja de pagos.</td></tr>';
    els.recordCount.textContent = '—';
    els.userLabel.textContent = '—';
    showLogin();
  }

  /* ------------------------------------------------------------------------
     API CALLS
     ------------------------------------------------------------------------ */
  function authHeaders() {
    return {
      'Authorization': 'Bearer ' + STATE.token,
      'Content-Type': 'application/json',
    };
  }

  function loadBandeja() {
    setStatus('Cargando…');
    els.statusMsg.style.color = '#48dbfb';

    // Cargar propiedades para resolver el código amigable
    fetch(API_BASE + '/propiedades', { headers: authHeaders() })
      .then(function (res) {
        if (res.status === 401) { logout(); throw new Error('Sesión expirada.'); }
        return res.json();
      })
      .then(function (props) {
        STATE.propiedades.clear();
        if (Array.isArray(props)) {
          for (var i = 0; i < props.length; i++) {
            STATE.propiedades.set(props[i].IdPropiedad, props[i].Codigo_Nro);
          }
        }
        return fetch(API_BASE + '/pagos/bandeja', { headers: authHeaders() });
      })
      .then(function (res) {
        if (res.status === 401) { logout(); throw new Error('Sesión expirada.'); }
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || 'Error al cargar la bandeja');
        renderTable(result.data);
        els.lastSync.textContent = 'Actualizado: ' + formatTime(new Date());
        setStatus('');
      })
      .catch(function (err) {
        setStatus('');
        if (err.message === 'Sesión expirada.') return;
        toast(err.message, 'error');
        els.pagosBody.innerHTML = '<tr class="empty-row"><td colspan="7">Error al cargar datos. Intente nuevamente.</td></tr>';
        els.recordCount.textContent = 'Error';
        els.statusMsg.style.color = '#ff6b6b';
      });
  }

  /* ------------------------------------------------------------------------
     RENDER
     ------------------------------------------------------------------------ */
  function renderTable(pagos) {
    var tbody = els.pagosBody;
    tbody.innerHTML = '';

    if (!pagos || pagos.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay pagos pendientes de verificación.</td></tr>';
      els.recordCount.textContent = '0 pagos pendientes';
      return;
    }

    for (var i = 0; i < pagos.length; i++) {
      var p = pagos[i];
      var tr = document.createElement('tr');
      tr.setAttribute('data-id', p.IdPago);

      var nroPropiedad = STATE.propiedades.get(p.IdPropiedad) || String(p.IdPropiedad);

      tr.innerHTML =
        '<td title="' + formatDateTime(p.Fecha_Reporte) + '">' + formatDate(p.Fecha_Reporte) + '</td>' +
        '<td>' + escapeHtml(nroPropiedad) + '</td>' +
        '<td title="' + escapeHtml(p.Referencia_Bancaria || '') + '">' + escapeHtml(p.Referencia_Bancaria || '—') + '</td>' +
        '<td>' + formatFormaPago(p.Forma_Pago) + '</td>' +
        '<td>' + formatCurrency(p.Monto) + '</td>' +
        '<td>' + comprobanteCell(p.Comprobante_Url) + '</td>' +
        '<td class="acciones">' +
          '<button class="btn-approve" data-id="' + p.IdPago + '">Aprobar</button>' +
          '<button class="btn-reject" data-id="' + p.IdPago + '">Rechazar</button>' +
        '</td>';

      tbody.appendChild(tr);
    }

    els.recordCount.textContent = pagos.length + ' pago(s) pendiente(s)';

    // Bind action buttons via delegation for performance
    tbody.removeEventListener('click', onActionClick);
    tbody.addEventListener('click', onActionClick);
  }

  function onActionClick(e) {
    var btn = e.target;
    if (btn.classList.contains('btn-approve')) {
      handleAprobar(Number(btn.getAttribute('data-id')), btn);
    } else if (btn.classList.contains('btn-reject')) {
      handleRechazar(Number(btn.getAttribute('data-id')), btn);
    }
  }

  /* ------------------------------------------------------------------------
     ACTIONS: APPROVE / REJECT
     ------------------------------------------------------------------------ */
  function handleAprobar(idPago, btn) {
    var row = btn.closest('tr');
    if (!row || row.classList.contains('removing')) return;

    disableRowButtons(row, true);
    setStatus('Aprobando pago #' + idPago + '…');

    fetch(API_BASE + '/pagos/aprobar', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ idPago: idPago }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || 'Error al aprobar');
        removeRow(row);
        toast('Pago ' + idPago + ' aprobado correctamente.', 'success');
        updateRecordCount();
        setStatus('');
      })
      .catch(function (err) {
        disableRowButtons(row, false);
        setStatus('');
        toast(err.message, 'error');
      });
  }

  function handleRechazar(idPago, btn) {
    var motivo = window.prompt('Motivo del rechazo:');
    if (!motivo || !motivo.trim()) return;

    var row = btn.closest('tr');
    if (!row || row.classList.contains('removing')) return;

    disableRowButtons(row, true);
    setStatus('Rechazando pago #' + idPago + '…');

    fetch(API_BASE + '/pagos/rechazar', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ idPago: idPago, motivoRechazo: motivo.trim() }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (!result.ok) throw new Error(result.data.error || 'Error al rechazar');
        removeRow(row);
        toast('Pago ' + idPago + ' rechazado.', 'success');
        updateRecordCount();
        setStatus('');
      })
      .catch(function (err) {
        disableRowButtons(row, false);
        setStatus('');
        toast(err.message, 'error');
      });
  }

  /* ------------------------------------------------------------------------
     ROW MANIPULATION
     ------------------------------------------------------------------------ */
  function removeRow(row) {
    row.classList.add('removing');
    row.addEventListener('transitionend', function cleanup() {
      row.removeEventListener('transitionend', cleanup);
      if (row.parentNode) row.parentNode.removeChild(row);
      updateRecordCount();
    });
  }

  function disableRowButtons(row, disabled) {
    var buttons = row.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = disabled;
      buttons[i].style.opacity = disabled ? '0.4' : '1';
      buttons[i].style.cursor = disabled ? 'default' : 'pointer';
    }
  }

  function updateRecordCount() {
    var tbody = els.pagosBody;
    var rows = tbody.querySelectorAll('tr:not(.empty-row):not(.removing)');
    els.recordCount.textContent = rows.length + ' pago(s) pendiente(s)';

    if (rows.length === 0 && !tbody.querySelector('.empty-row')) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay pagos pendientes de verificación.</td></tr>';
    }
  }

  /* ------------------------------------------------------------------------
     TOAST
     ------------------------------------------------------------------------ */
  function toast(message, type) {
    type = type || 'info';
    var container = els.toastContainer;
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(function () {
      el.classList.add('fade-out');
      el.addEventListener('animationend', function cleanup() {
        el.removeEventListener('animationend', cleanup);
        if (el.parentNode) container.removeChild(el);
      });
    }, 3500);
  }

  /* ------------------------------------------------------------------------
     HELPERS
     ------------------------------------------------------------------------ */
  function setStatus(msg) {
    els.statusMsg.textContent = msg || '';
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    var dd = ('0' + d.getDate()).slice(-2);
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    return dd + '/' + mm + '/' + d.getFullYear();
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return formatDate(dateStr) + ' ' +
      ('0' + d.getHours()).slice(-2) + ':' +
      ('0' + d.getMinutes()).slice(-2);
  }

  function formatTime(date) {
    return ('0' + date.getHours()).slice(-2) + ':' +
      ('0' + date.getMinutes()).slice(-2) + ':' +
      ('0' + date.getSeconds()).slice(-2);
  }

  function formatCurrency(amount) {
    return '$ ' + Number(amount).toFixed(2);
  }

  function formatFormaPago(fp) {
    var map = { 1: 'Transferencia', 2: 'Pago Móvil', 3: 'Efectivo', 4: 'Zelle' };
    return map[fp] || 'N/D';
  }

  function comprobanteCell(url) {
    if (!url) return '—';
    return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener" class="comprobante-link">Ver</a>';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
})();
