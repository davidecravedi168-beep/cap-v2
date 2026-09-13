document.querySelector('#width').addEventListener('change', e => {
  document.querySelector('iframe').width = e.target.value;
  document.querySelector('#size').textContent = `${e.target.value} px`;
});
