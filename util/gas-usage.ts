import {SendMessageResult} from '@ton-community/sandbox';

export function gasUsage(messageResult: SendMessageResult): bigint {
	return messageResult.transactions.reduce((gas, tx) => {
		return gas + tx.totalFees.coins;
	}, 0n)
}
