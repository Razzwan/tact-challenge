import {Blockchain, SandboxContract, SendMessageResult} from '@ton-community/sandbox';
import { toNano } from 'ton-core';
import { Task1 } from '../wrappers/Task1';
import '@ton-community/test-utils';
import {gasCompare} from '../util/gas-usage';

describe('Task1', () => {
	let blockchain: Blockchain;
	let task1: SandboxContract<Task1>;

	beforeEach(async () => {
		blockchain = await Blockchain.create();
		task1 = blockchain.openContract(await Task1.fromInit());
		const deployer = await blockchain.treasury('deployer');
		const deployResult = await task1.send(
			deployer.getSender(),
			{
				value: toNano('0.05'),
			},
			{
				$$type: 'Deploy',
				queryId: 0n,
			}
		);
		expect(deployResult.transactions).toHaveTransaction({
			from: deployer.address,
			to: task1.address,
			deploy: true,
			success: true,
		});
	});

	const act = async (action: 'Add' | 'Subtract', number: bigint): Promise<SendMessageResult> => {
		const deployer = await blockchain.treasury('deployer');
		return await task1.send(
			deployer.getSender(),
			{
				value: toNano('0.05'),
			},
			{
				$$type: action,
				queryId: 0n,
				number: number,
			}
		);
	};

	it('Add', async () => {
		const r = await act('Add', 10n);

		expect(await task1.getCounter()).toBe(10n);
		expect(r.transactions.length).toEqual(2);
		gasCompare(r, 7195328n);
	});

	it('Subtract', async () => {
		const r1 = await act('Add', 10n);
		const r2 = await act('Subtract', 1n);

		expect(await task1.getCounter()).toBe(9n);

		gasCompare(r1, 7195328n);
		gasCompare(r2, 7298328n);
	});
});
