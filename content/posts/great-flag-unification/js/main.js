const SIZE = 100.0;
const DIVISIONS = 12;
const INC = SIZE / DIVISIONS;
const normalizeRe = /\s+/g;

const fn = {
	r: (ctx, x, y, w, h, t) => {
		if (t == "*") {
			ctx.fillRect(x * INC, y * INC, w * INC, h * INC);
		} else {
			ctx.lineWidth = parseInt(t);
			ctx.strokeRect(x * INC, y * INC, w * INC, h * INC);
		}
	},
	c: (ctx, x, y, w, _, t) => {
		ctx.beginPath();
		ctx.arc(x * INC, y * INC, w * INC, 0, 2 * Math.PI);
		if (t == "*") {
			ctx.fill();
		} else {
			ctx.lineWidth = parseInt(t);
			ctx.stroke();
		}
	},
	t: (ctx, x, y, r, a, t) => {
		x *= INC;
		y *= INC;
		r *= INC;
		a -= 2;
		a *= (45 * Math.PI) / 180;

		const a0 = a;
		const a1 = a + (2 * Math.PI) / 3;
		const a2 = a + (4 * Math.PI) / 3;

		ctx.beginPath();
		ctx.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0));
		ctx.lineTo(x + r * Math.cos(a1), y + r * Math.sin(a1));
		ctx.lineTo(x + r * Math.cos(a2), y + r * Math.sin(a2));
		ctx.closePath();

		if (t == "*") {
			ctx.fill();
		} else {
			ctx.lineWidth = parseInt(t);
			ctx.stroke();
		}
	},
};

const fn2 = {
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
		let rx = w;
		let ry = h;

		e.setAttribute("cx", x + rx);
		e.setAttribute("cy", y + ry);
		e.setAttribute("rx", rx);
		e.setAttribute("ry", ry);

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

		let e = fn2[f](x, y, w, h);

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
	console.log(e);
	draw2(e.parentNode.parentNode.querySelector("svg"), e.innerText.trim(""));
});
