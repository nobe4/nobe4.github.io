let available_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
let index = 0;
let letters = [];
let seen = [];
let score = 0;

window.gen = () => {
	board.innerHTML = "";
	active_cards = 0;
	index = 0;
	score = 0;
	letters = [];
	seen = [];

	gen_seen();
	gen_letters();
	display_next_letter();
	counter.innerText = `1/${value_count.value}`;
};

window.click_button = (seen) => {
	let was_seen = index > 2 && letters[index - 1] == letters[index - 3];

	if (seen == was_seen) {
		result.innerText = "✓";
		score += 1;
	} else {
		result.innerText = "✗";
	}

	if (index == letters.length) {
		alert(`score: ${score}/${value_count.value}`);
		gen();
		return;
	}

	display_next_letter();
};

function display_next_letter() {
	board.innerHTML = letters[index];
	index++;
	counter.innerText = `${index}/${value_count.value}`;
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

function gen_seen() {
	seen = new Array(Number(value_count.value) - 2);
	seen.fill(false);
	let true_count = 2 + Math.ceil(seen.length / 5.0);
	seen.fill(true, 0, true_count);

	shuffle(seen);

	// TODO make it work with x_back_count > 2
	seen.unshift(false, false);
}

function gen_letters() {
	letters = [];
	shuffle(available_letters);

	for (let i = 0; i < seen.length; i++) {
		if (seen[i]) {
			letters.push(letters[i - 2]);
		} else {
			letters.push(available_letters[i % available_letters.length]);
		}
	}
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

gen();
