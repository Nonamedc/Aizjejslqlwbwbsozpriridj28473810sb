/* ══════════════════════════════════════════════
   SIDEBAR DRAWER (mobile)
══════════════════════════════════════════════ */
function openSidebarDrawer(){
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
  history.pushState({ arya: 'sidebar' }, '');
}
function closeSidebarDrawer(){
  const sidebar = document.querySelector('.sidebar');
  if(!sidebar?.classList.contains('open')) return;
  sidebar.classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
  if(history.state?.arya === 'sidebar') history.back();
}

// Ferme le drawer automatiquement sur chaque nav-item
document.querySelectorAll('.nav-item').forEach(el =>
  el.addEventListener('click', () => {
    if(window.innerWidth <= 640) closeSidebarDrawer();
  })
);

