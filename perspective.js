(() => {
  "use strict";

  const room = document.querySelector(".room");
  const orientationHint = document.querySelector(".orientation-hint");
  if (!room) return;

  const portraitPhone = window.matchMedia(
    "(orientation: portrait) and (max-width: 760px)",
  );
  let hintTimer;

  function updateOrientationHint() {
    clearTimeout(hintTimer);
    orientationHint?.classList.remove("is-visible");
    if (!portraitPhone.matches || !orientationHint) return;

    requestAnimationFrame(() => {
      orientationHint.classList.add("is-visible");
    });
    hintTimer = window.setTimeout(() => {
      orientationHint.classList.remove("is-visible");
    }, 4200);
  }

  updateOrientationHint();
  portraitPhone.addEventListener?.("change", updateOrientationHint);

  if (!window.DOMMatrix) return;

  const surfaces = new Map(
    [...document.querySelectorAll("[data-surface]")].map((element) => [
      element.dataset.surface,
      element,
    ]),
  );

  function solve(matrix, vector) {
    const size = vector.length;
    const augmented = matrix.map((row, index) => [...row, vector[index]]);

    for (let column = 0; column < size; column += 1) {
      let pivot = column;
      for (let row = column + 1; row < size; row += 1) {
        if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
          pivot = row;
        }
      }

      if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
      [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];

      const divisor = augmented[column][column];
      for (let index = column; index <= size; index += 1) {
        augmented[column][index] /= divisor;
      }

      for (let row = 0; row < size; row += 1) {
        if (row === column) continue;
        const factor = augmented[row][column];
        for (let index = column; index <= size; index += 1) {
          augmented[row][index] -= factor * augmented[column][index];
        }
      }
    }

    return augmented.map((row) => row[size]);
  }

  function homography(source, destination) {
    const matrix = [];
    const vector = [];

    for (let index = 0; index < 4; index += 1) {
      const [x, y] = source[index];
      const [u, v] = destination[index];
      matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
      vector.push(u);
      matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
      vector.push(v);
    }

    return solve(matrix, vector);
  }

  function project(transform, x, y) {
    const [a, b, c, d, e, f, g, h] = transform;
    const scale = g * x + h * y + 1;
    return [
      (a * x + b * y + c) / scale,
      (d * x + e * y + f) / scale,
    ];
  }

  function regionOnPlane(plane, [u0, v0, u1, v1]) {
    const planeTransform = homography(
      [[0, 0], [1, 0], [1, 1], [0, 1]],
      plane,
    );
    return [
      project(planeTransform, u0, v0),
      project(planeTransform, u1, v0),
      project(planeTransform, u1, v1),
      project(planeTransform, u0, v1),
    ];
  }

  function applySurface(name, destination) {
    const element = surfaces.get(name);
    if (!element || element.offsetWidth === 0 || element.offsetHeight === 0) return;

    const originX = element.offsetLeft;
    const originY = element.offsetTop;
    const localDestination = destination.map(([x, y]) => [
      x - originX,
      y - originY,
    ]);
    const source = [
      [0, 0],
      [element.offsetWidth, 0],
      [element.offsetWidth, element.offsetHeight],
      [0, element.offsetHeight],
    ];
    const transform = homography(source, localDestination);
    if (!transform) return;

    const [a, b, c, d, e, f, g, h] = transform;
    const values = [
      a, d, 0, g,
      b, e, 0, h,
      0, 0, 1, 0,
      c, f, 0, 1,
    ].map((value) => Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12)));

    element.style.transform = `matrix3d(${values.join(",")})`;
  }

  function updatePerspective() {
    const width = room.clientWidth;
    const height = room.clientHeight;
    const compactLandscape = width > height && height <= 600;
    const mobile = !compactLandscape && width <= 760;
    const centerX = width * (mobile ? 0.48 : 0.5);
    const cornerY = height * (mobile ? 0.60 : 0.68);
    const sideY = height * (mobile ? 0.79 : 0.88);

    const leftWall = [
      [0, 0],
      [centerX, 0],
      [centerX, cornerY],
      [0, sideY],
    ];
    const rightWall = [
      [centerX, 0],
      [width, 0],
      [width, sideY],
      [centerX, cornerY],
    ];
    const regions = compactLandscape
      ? {
          signature: [0.09, 0.055, 0.22, 0.085],
          about: [0.09, 0.13, 0.78, 0.64],
          publication: [0.14, 0.12, 0.90, 0.64],
          contact: [0.72, 0.045, 0.92, 0.13],
        }
      : mobile
        ? {
          signature: [0.10, 0.055, 0.42, 0.075],
          about: [0.10, 0.15, 0.90, 0.50],
          publication: [0.08, 0.14, 0.92, 0.51],
          contact: [0.52, 0.035, 0.92, 0.105],
          }
        : {
          signature: [0.09, 0.055, 0.17, 0.075],
          about: [0.09, 0.20, 0.70, 0.57],
          publication: [0.17, 0.18, 0.90, 0.55],
          contact: [0.78, 0.045, 0.92, 0.12],
          };

    applySurface("left-signature", regionOnPlane(leftWall, regions.signature));
    applySurface("left-about", regionOnPlane(leftWall, regions.about));
    applySurface("right-publication", regionOnPlane(rightWall, regions.publication));
    applySurface("right-contact", regionOnPlane(rightWall, regions.contact));

    const titleDestination = compactLandscape
      ? [
          [width * 0.34, height * 0.73],
          [width * 0.66, height * 0.73],
          [width * 0.76, height * 0.95],
          [width * 0.24, height * 0.95],
        ]
      : mobile
        ? [
          [width * 0.24, height * 0.75],
          [width * 0.72, height * 0.75],
          [width * 0.88, height * 0.92],
          [width * 0.08, height * 0.92],
          ]
        : [
          [width * 0.30, height * 0.76],
          [width * 0.70, height * 0.76],
          [width * 0.82, height * 0.92],
          [width * 0.18, height * 0.92],
          ];
    applySurface("floor-title", titleDestination);

    document.documentElement.classList.add("perspective-enabled");
  }

  let frame;
  const scheduleUpdate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updatePerspective);
  };

  scheduleUpdate();
  new ResizeObserver(scheduleUpdate).observe(room);
  window.addEventListener("orientationchange", scheduleUpdate);
})();
