document.addEventListener("DOMContentLoaded", () => {
  const { shell } = require('electron');

  document.getElementById('link').addEventListener('click', (event) => {
    event.preventDefault();
    alert("ssssssss")

    shell.openExternal('https://www.example.com');
  });
});
