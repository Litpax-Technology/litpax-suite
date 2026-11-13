/* ui-preview.html — tabs / segmented control click demo */
(function () {
  ['seg', 'tabs'].forEach(function (id) {
    var box = document.getElementById(id);
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      Array.prototype.forEach.call(box.querySelectorAll('button'), function (x) { x.classList.remove('is-active'); });
      b.classList.add('is-active');
    });
  });
})();
