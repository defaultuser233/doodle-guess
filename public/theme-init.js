try {
  var savedTheme = localStorage.getItem('doodle-guess-theme-v1')
  var initialTheme =
    savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  document.documentElement.dataset.theme = initialTheme
  document.documentElement.style.colorScheme = initialTheme
} catch (error) {
  document.documentElement.dataset.theme = 'light'
}
