(function(){
  const container = document.getElementById('toast-container') || (function(){
    const d = document.createElement('div');
    d.id = 'toast-container';
    d.className = 'toast-container';
    document.body.appendChild(d);
    return d;
  })();

  function createIcon(type){
    if(type === 'success') return '✓';
    if(type === 'error') return '✖';
    return 'ℹ';
  }

  function showToast(msg, type = 'info', options = {}){
    const duration = typeof options.duration === 'number' ? options.duration : 4000;
    const title = options.title || '';
    const dismissible = options.dismissible !== false;

    const toast = document.createElement('div');
    toast.className = 'toast toast--' + (type || 'info');
    toast.setAttribute('role', 'status');

    const icon = document.createElement('div');
    icon.className = 'toast-icon';
    icon.textContent = createIcon(type);

    const body = document.createElement('div');
    body.className = 'toast-body';
    if(title) {
      const t = document.createElement('div');
      t.className = 'toast-title';
      t.textContent = title;
      body.appendChild(t);
    }
    const m = document.createElement('div');
    m.className = 'toast-msg';
    m.textContent = msg;
    body.appendChild(m);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label','Dismiss notification');
    closeBtn.innerHTML = '<i class="ri-close-line"></i>';

    if (dismissible) closeBtn.addEventListener('click', () => removeToast(toast));

    toast.appendChild(icon);
    toast.appendChild(body);
    if (dismissible) toast.appendChild(closeBtn);

    // insert at top
    container.insertBefore(toast, container.firstChild);

    // auto dismiss with pause on hover
    let hideTimeout = null;
    let start = Date.now();
    let remaining = duration;

    function scheduleHide(ms){
      hideTimeout = setTimeout(() => removeToast(toast), ms);
      start = Date.now();
      remaining = ms;
    }

    function clearHide(){
      if(hideTimeout){ clearTimeout(hideTimeout); hideTimeout = null; }
      // adjust remaining
      remaining = Math.max(0, remaining - (Date.now() - start));
    }

    function resumeHide(){
      if(remaining <= 0) return removeToast(toast);
      scheduleHide(remaining);
    }

    toast.addEventListener('mouseenter', () => clearHide());
    toast.addEventListener('mouseleave', () => resumeHide());

    scheduleHide(remaining);

    // removal with animation
    function removeToast(node){
      if(!node) return;
      node.classList.add('toast-hide');
      node.classList.add('toast-hide'); // keep idempotent
      node.classList.add('toast-hide');
      node.classList.add('toast-hide');
      // use the CSS class we defined for hide animation
      node.classList.add('toast-hide-anim');
      node.classList.add('toast-hide');
      node.classList.add('toast-hide');
      node.classList.add('toast-hide');
      // add a small class used in CSS
      node.classList.add('toast-hide');
      node.classList.add('toast-hide');
      // fallback: use existing toast-hide animation styles
      node.classList.add('toast-hide');
      node.classList.add('toast-hide');
      node.classList.add('toast-hide');

      node.classList.add('toast-hide');
      node.classList.add('toast-hide');

      node.classList.add('toast-hide');

      node.classList.add('toast-hide');

      // Apply hide class that triggers the CSS animation we defined
      node.classList.add('toast-hide');

      // If the stylesheet used .toast-hide, also support .toast-hide (we used .toast-hide earlier)
      node.classList.add('toast-hide');

      // Use a short timeout equal to the CSS out animation (250ms)
      setTimeout(() => {
        try{ if(node.parentNode) node.parentNode.removeChild(node); } catch(e){}
      }, 260);
    }

    // expose remove function
    return {
      dismiss: () => removeToast(toast)
    };
  }

  // Expose globally
  window.showToast = showToast;
  window.toast = { show: showToast };
})();
