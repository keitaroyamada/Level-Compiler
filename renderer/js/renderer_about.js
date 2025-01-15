document.addEventListener("DOMContentLoaded", () => {

  window.AboutApi.receive("Version", async (data) => {
    document.getElementById('app_version').textContent = data;
  });

  document.getElementById('link').addEventListener('click', (event) => {
    event.preventDefault();
    
    window.AboutApi.openExtarnalLink('https://github.com/keitaroyamada/Level-Compiler');
  });
});
