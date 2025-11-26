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
		a *= Math.PI / 180;

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

const draw = (canvas, code) => {
	let ctx = canvas.getContext("2d");
	canvas.width = SIZE;
	canvas.height = SIZE;

	fn["r"](ctx, 0, 0, DIVISIONS, DIVISIONS, "*", "white");

	code.split("\n").forEach((line) => {
		let [f, x, y, w, h, t, color] = line.replace(normalizeRe, " ").split(" ");

		if (w == "*") w = DIVISIONS;
		if (h == "*") h = DIVISIONS;

		ctx.strokeStyle = color;
		ctx.fillStyle = color;
		ctx.lineWidth = 1;

		fn[f](ctx, parseFloat(x), parseFloat(y), parseFloat(w), parseFloat(h), t);
	});
};

document.querySelectorAll('code[data-lang="flag"]').forEach((e) => {
	draw(e.parentNode.parentNode.querySelector("canvas"), e.innerText.trim());
});
