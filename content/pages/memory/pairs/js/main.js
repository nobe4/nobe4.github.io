const board = document.getElementById("board");

let available_colors = [
	["aqua", "A"],
	["lime", "L"],
	["yellow", "Y"],
	["fuchsia", "F"],
];
let active_cards = [];
let solved_pairs = 0;

let start;

window.gen = () => {
	board.innerHTML = "";

	gen_items(value_count.value).forEach(gen_card);
};

window.click_card = (e) => {
	if (start == undefined) {
		start = Date.now();
	}

	if (active_cards.indexOf(e.target) != -1) {
		return;
	}

	if (active_cards.length == 2) {
		clean_active_cards();
	}

	e.target.classList.toggle("active");
	e.target.style.backgroundColor = e.target.getAttribute("data-c");
	e.target.innerHTML = e.target.getAttribute("data-v");
	active_cards.push(e.target);

	if (active_cards.length == 2) {
		check_active_cards();
	}

	if (solved_pairs == value_count.value * color_count.value) {
		let ms = Date.now() - start;
		let minutes = Math.floor(ms / 60000);
		let seconds = ((ms % 60000) / 1000).toFixed(0);

		alert(`Solved in ${minutes}m${seconds}s`);

		gen();
	}
};

function cards_equal(a, b) {
	return (
		a.getAttribute("data-v") == b.getAttribute("data-v") &&
		a.getAttribute("data-c") == b.getAttribute("data-c")
	);
}

function clean_active_cards() {
	for (let e of active_cards) {
		e.innerHTML = "";
		e.style.backgroundColor = "";
	}
	active_cards = [];
}

function check_active_cards() {
	if (!cards_equal(active_cards[0], active_cards[1])) {
		return;
	}

	for (let e of active_cards) {
		if (delete_on_match.checked) {
			debugger;
		} else {
			e.removeEventListener("click", click_card);
			e.innerHTML = "✓";
			e.style.backgroundColor = "white";
		}
	}

	solved_pairs++;
	active_cards = [];
}

function gen_items(count) {
	let items = [];
	const colors = available_colors.slice(0, color_count.value);

	for (let i = 0; i < count; i++) {
		for (let c of colors) {
			items.push({ v: i, c: c });
			items.push({ v: i, c: c });
		}
	}

	return shuffle(items);
}

// https://stackoverflow.com/a/2450976
function shuffle(array) {
	let currentIndex = array.length;

	while (currentIndex != 0) {
		let randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;
		[array[currentIndex], array[randomIndex]] = [
			array[randomIndex],
			array[currentIndex],
		];
	}

	return array;
}

function gen_card({ v, c }) {
	let card = document.createElement("div");
	card.classList.add("card");
	card.setAttribute("data-v", v + c[1]);
	card.setAttribute("data-c", c[0]);
	card.addEventListener("click", click_card);
	board.appendChild(card);
}

gen();
