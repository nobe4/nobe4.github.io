const SIZE = 100.0;
const DIVISIONS = 12;
const INC = SIZE / DIVISIONS;
const normalizeRe = /\s+/g;

const fn = {
	r: (x, y, w, h) => {
		let e = document.createElementNS("http://www.w3.org/2000/svg", "rect");

		e.setAttribute("x", x);
		e.setAttribute("y", y);
		e.setAttribute("width", w);
		e.setAttribute("height", h);

		return e;
	},
	c: (x, y, w, h) => {
		let e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");

		e.setAttribute("cx", x + w);
		e.setAttribute("cy", y + h);
		e.setAttribute("rx", w);
		e.setAttribute("ry", h);

		return e;
	},
	t: (x, y, w, h) => {
		let e = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
		let points = [
			[x, y],
			[x + w, y],
			[x + w / 2, y + h],
		]
			.map((p) => p.join(","))
			.join(" ");
		e.setAttribute("points", points);
		return e;
	},
	h: (x, y, w, h) => {
		let e = document.createElementNS("http://www.w3.org/2000/svg", "path");

		e.setAttribute(
			"d",
			`M ${x} ${y + h / 2} A ${w / 2} ${h / 2} 0 0 1 ${x + w} ${y + h / 2}`,
		);

		return e;
	},
};

const draw2 = (svg, code) => {
	code.split("\n").forEach((line) => {
		let [f, x, y, w, h, a, t, c] = line.replace(normalizeRe, " ").split(" ");

		if (w == "*") w = DIVISIONS;
		if (h == "*") h = DIVISIONS;
		a = parseFloat(a);

		x = parseFloat(x) * INC;
		y = parseFloat(y) * INC;
		w = parseFloat(w) * INC;
		h = parseFloat(h) * INC;
		const center = [x + w / 2, y + h / 2];

		let e = fn[f](x, y, w, h);

		if (t == "*") {
			e.setAttribute("fill", c);
		} else {
			e.setAttribute("fill", "transparent");
			e.setAttribute("stroke", c);
			e.setAttribute("stroke-width", t);
		}

		if (a > 0) {
			e.setAttribute(
				"transform",
				`rotate(${a * 45} ${center[0]} ${center[1]})`,
			);
		}

		svg.appendChild(e);
	});
};

document.querySelectorAll(".flag").forEach((e) => {
	e.addEventListener("click", () => e.classList.toggle("simple"));
});

document.querySelectorAll('code[data-lang="flag"]').forEach((e) => {
	draw2(e.parentNode.parentNode.querySelector("svg"), e.innerText.trim(""));
});
