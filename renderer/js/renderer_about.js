document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('link').addEventListener('click', (event) => {
    event.preventDefault();
    window.AboutApi.openExtarnalLink('https://github.com/keitaroyamada/Level-Compiler');
  });
});
