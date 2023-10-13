import {Blockchain, SandboxContract} from '@ton-community/sandbox';
import {toNano} from 'ton-core';
import {Task1} from '../wrappers/Task1';
import '@ton-community/test-utils';

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

	const act = async (action: 'Add' | 'Subtract', number: bigint) => {
		const deployer = await blockchain.treasury('deployer');
		await task1.send(
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
		await act('Add', 10n);

		expect(await task1.getCounter()).toBe(10n);
	});

	it('Subtract', async () => {
		await act('Add', 10n);
		await act('Subtract', 1n);

		expect(await task1.getCounter()).toBe(9n);
	});
});
