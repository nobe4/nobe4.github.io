let available_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let active_cards = [];
let solved_pairs = 0;

let start;

window.gen = () => {
	board.innerHTML = "";
	active_cards = [];
	solved_pairs = 0;
	start = undefined;
	total.innerText = `Total: ${value_count.value * letter_count.value * 2}`;

	gen_items(value_count.value).forEach(gen_card);
};

window.click_card = (e) => {
	if (start == undefined) {
		start = Date.now();
	}

	if (active_cards.length == 2) {
		clean_active_cards();
	}

	if (active_cards.indexOf(e.target) != -1) {
		return;
	}

	e.target.classList.toggle("active");
	e.target.innerHTML = e.target.getAttribute("data-v");
	active_cards.push(e.target);

	if (active_cards.length == 2) {
		check_active_cards();
	}

	if (solved_pairs == value_count.value * letter_count.value) {
		let ms = Date.now() - start;
		let minutes = Math.floor(ms / 60000);
		let seconds = ((ms % 60000) / 1000).toFixed(0);

		alert(`Solved in ${minutes}m${seconds}s`);

		gen();
	}
};

function clean_active_cards() {
	for (let e of active_cards) {
		e.innerHTML = "";
		e.style.backgroundColor = "";
	}
	active_cards = [];
}

function check_active_cards() {
	if (
		active_cards[0].getAttribute("data-v") !=
		active_cards[1].getAttribute("data-v")
	) {
		return;
	}

	for (let e of active_cards) {
		e.removeEventListener("click", click_card);
		e.innerHTML = "✓";
		e.classList.toggle("active");
		e.classList.toggle("solved");
	}

	solved_pairs++;
	active_cards = [];
}

function gen_items(count) {
	let items = [];
	const colors = available_letters.slice(0, letter_count.value);

	for (let i = 0; i < count; i++) {
		for (let c of colors) {
			items.push(`${i}${c}`);
			items.push(`${i}${c}`);
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

function gen_card(v) {
	let card = document.createElement("div");
	card.classList.add("card");
	card.setAttribute("data-v", `${v}`);
	card.addEventListener("click", click_card);
	board.appendChild(card);
}

gen();
