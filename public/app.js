const live = document.querySelector("[data-live]");
if (live) {
  window.setInterval(async () => {
    if (document.hidden) return;
    try {
      const response = await fetch(live.getAttribute("data-live"), { headers: { Accept: "text/html" } });
      if (!response.ok) return;
      const html = await response.text();
      if (html && html !== live.innerHTML) live.innerHTML = html;
    } catch {
      // The next poll can try again.
    }
  }, 8000);
}
