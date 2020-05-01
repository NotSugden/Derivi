import Command, { CommandData } from '../../structures/Command';
import CommandArguments from '../../structures/CommandArguments';
import Points from '../../structures/Points';
import Message from '../../structures/discord.js/Message';
import CommandError from '../../util/CommandError';
import CommandManager from '../../util/CommandManager';
import { Responses, MatchState } from '../../util/Constants';
export interface Card {
	weight: number;
	suit: 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
	value: '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
}

const CARDS: Card[] = [];
const SUITS: Card['suit'][] = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const CARD_VALUES: Card['value'][] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

for (const value of CARD_VALUES) {
	for (const suit of SUITS) {
		CARDS.push({
			suit,
			value,
			weight: ['J', 'Q', 'K', 'A'].includes(value) ?
				(value === 'A' ? 11 : 10) :
				parseInt(value)
		});
	}
}

const shuffleDeck = () => {
	const cards = CARDS.slice();
	const deck = [];
	for(let i = 0;i < CARDS.length;i++) {
		deck[i] = cards[Math.floor(Math.random() * cards.length)];
		cards.splice(cards.indexOf(deck[i]), 1);
	}
	return deck;
};

const getWeight = (deck: Card[]) => deck.reduce((acc, card) => acc + card.weight, 0);

const play = async (message: Message, points: Points, bet: { bet: number }): Promise<MatchState> => {

	const dealerCards: Card[] = [];
	const userCards: Card[] = [];
	const deck = shuffleDeck();

	const giveCard = (hand: Card[]) => hand.push(deck.pop()!);

	giveCard(dealerCards);
	giveCard(userCards);
	giveCard(userCards);

	if (getWeight(userCards) >= 21) return play(message, points, bet);

	const responseMessage = await message.channel.send(Responses.BLACKJACK_MESSAGE(
		userCards,
		dealerCards,
		bet.bet
	));

	const updateMessage = () => {
		return responseMessage.edit(Responses.BLACKJACK_MESSAGE(
			userCards,
			dealerCards,
			bet.bet
		));
	};

	return new Promise<MatchState>((resolve, reject) => {
		const RESPONSES = [
			'rules',
			'hit',
			'stand',
			'double'
		];
		const collector = message.channel.createMessageCollector(
			msg => msg.author.id === message.author.id && RESPONSES.includes(
				msg.content.toLowerCase()
			), { idle: 2e4 }
		);
		collector.on('end', async (collected, reason) => {
			if (collected.size) {
				await message.channel.bulkDelete(collected)
					.catch(reject);
			}
			if (reason === 'idle') {
				resolve('idle');
			} else if (reason === 'lost') {
				resolve('lost');
			} else if (reason === 'won') {
				resolve('won');
			} else if (reason === 'draw') {
				resolve('draw');
			}
		});
		collector.on('collect', async (msg: Message) => {
			const content = msg.content.toLowerCase();
			if (content === 'rules') {
				msg.channel.send(Responses.BLACKJACK_RULES())
					.catch(reject);
			} else if (['hit', 'double'].includes(content)) {
				if (content === 'double') {
					if (points.amount < (bet.bet * 2)) {
						return reject(new CommandError(
							'NOT_ENOUGH_POINTS',
							bet.bet * 2
						));
					}
					bet.bet *= 2;
				}
				giveCard(userCards);
				if (getWeight(userCards) >= 21) {
					while(getWeight(dealerCards) < 17) {
						giveCard(dealerCards);
					}
					await updateMessage();
					const userWeight = getWeight(userCards);
					const dealerWeight = getWeight(dealerCards);
					if (
						userWeight === dealerWeight ||
						userWeight > 21 || dealerWeight > 21
					) {
						return collector.stop('draw');
					}
					return collector.stop(userWeight === 21 ? 'won' : 'lost');
				}
				if (content === 'double') await updateMessage();
			} else if (content === 'stand') {
				while(getWeight(dealerCards) < 17) {
					giveCard(dealerCards);
				}
				await updateMessage();
				const dealerWeight = getWeight(dealerCards);
				if (dealerWeight === getWeight(userCards)) {
					return collector.stop('draw');
				} else if (dealerWeight > 21) {
					return collector.stop('won');
				}
				collector.stop(dealerWeight > getWeight(userCards) ? 'lost' : 'won');
			}
		});
	});
};

export default class Blackjack extends Command {
	constructor(manager: CommandManager) {
		super(manager, {
			aliases: [],
			category: 'Points',
			cooldown: 5,
			name: 'blackjack',
			usages: [{
				type: 'bet'
			}]
		}, __filename);
	}

	public async run(message: Message, args: CommandArguments, { send }: CommandData) {
		if (message.editedTimestamp) return;
		if (!args[0]) {
			return send(Responses.BLACKJACK_RULES());
		}

		if (this.client.lockedPoints.has(message.author.id)) {
			throw new CommandError('LOCKED_POINTS');
		}

		const bet = { bet: parseInt(args[0]) };
		if (isNaN(bet.bet) || bet.bet < 1) {
			throw new CommandError('INVALID_NUMBER', { min: 1 });
		}

		const points = await this.client.database.points(message.author);
		if (points.amount < bet.bet) {
			throw new CommandError('NOT_ENOUGH_POINTS', bet.bet );
		}

		this.client.lockedPoints.add(message.author.id);

		const matchResult = await play(message, points, bet);

		this.client.lockedPoints.delete(message.author.id);

		if (matchResult === 'won') {
			await points.set({
				points: points.amount + bet.bet
			});
		} else {
			await points.set({
				points: points.amount - bet.bet
			});
		}

		return send(Responses.GAME_END_STATE(matchResult, bet.bet));
	}
}