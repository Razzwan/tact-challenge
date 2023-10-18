import {Blockchain, SandboxContract, SendMessageResult} from '@ton-community/sandbox';
import {Address, beginCell, Sender, toNano} from 'ton-core';
import { Task2 } from '../wrappers/Task2';
import '@ton-community/test-utils';
import {gasCompare} from '../util/gas-usage';

type S = Sender & {
	address: Address;
}

describe('Task2', () => {
	let blockchain: Blockchain;
	let task2: SandboxContract<Task2>;
	let admin: S;
	let notAdmin: S;
	let oneMore: S;

	beforeEach(async () => {
		blockchain = await Blockchain.create();

		const addresses = await blockchain.createWallets(4);

		admin = addresses[0].getSender();
		notAdmin = addresses[1].getSender();
		oneMore = addresses[2].getSender();

		task2 = blockchain.openContract(await Task2.fromInit(admin.address));
		const deployer = await blockchain.treasury('deployer');
		const deployResult = await task2.send(
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
			to: task2.address,
			deploy: true,
			success: true,
		});
	});

	const act = async (value: number, bits: number): Promise<SendMessageResult> => {
		const deployer = await blockchain.treasury('deployer');
		return await task2.send(
			deployer.getSender(),
			{
				value: toNano('0.05'),
			},
			beginCell().storeUint(value, bits).asSlice()
		);
	};

	const bounce = async (sender: S, messageSender: Address): Promise<SendMessageResult> => {
		return await task2.send(
			sender,
			{
				value: toNano('0.05'),
			},
			{
				$$type: 'Bounced',
				queryId: 0n,
				sender: messageSender
			}
		);
	};

	it('gas usage 1', async () => {
		const r = await act(0, 1);

		gasCompare(r, 12738653n);
	});

	it('gas usage 2', async () => {
		const r = await act(12, 32);

		gasCompare(r, 12854987n);
	});

	it('bounce correct', async () => {
		const r = await bounce(admin, oneMore.address);

		gasCompare(r, 12686320n);
	});

	it('bounce not by admin', async () => {
		const r = await bounce(notAdmin, oneMore.address);

		gasCompare(r, 8302987n);
	});
});
