import {SendMessageResult} from '@ton-community/sandbox';

export function gasUsage(messageResult: SendMessageResult): bigint {
	return messageResult.transactions.reduce((gas, tx) => {
		return gas + tx.totalFees.coins;
	}, 0n)
}

export function gasCompare(messageResult: SendMessageResult, toCompare: bigint): void {
	const gas = gasUsage(messageResult);
	expect(gas).toBeGreaterThanOrEqual(toCompare);
	expect(gas).toBeLessThanOrEqual(toCompare + 2n);
}
