window.AboutApi.receive("Version", async (data) => {
  const versionElement = document.getElementById("app_version");
  if (versionElement) {
    versionElement.textContent = "Version: " + data;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('link').addEventListener('click', (event) => {
    event.preventDefault();
    
    window.AboutApi.openExtarnalLink({ url: 'https://github.com/keitaroyamada/Level-Compiler' });
  });
});
