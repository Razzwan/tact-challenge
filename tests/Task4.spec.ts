import {Blockchain, SandboxContract, SendMessageResult} from '@ton-community/sandbox';
import {Address, Dictionary, beginCell, Cell, toNano} from 'ton-core';
import {Task4} from '../wrappers/Task4';
import '@ton-community/test-utils';

describe('Task4', () => {
	let blockchain: Blockchain;
	let task4: SandboxContract<Task4>;
	let nft: Address;
	let nft2: Address;
	let owner: Address;
	let owner2: Address;
	let sender: Address;

	beforeEach(async () => {
		blockchain = await Blockchain.create();

		const addresses = await blockchain.createWallets(5);
		nft = addresses[0].getSender().address;
		nft2 = addresses[1].getSender().address;
		owner = addresses[2].getSender().address;
		owner2 = addresses[3].getSender().address;
		sender = addresses[4].getSender().address;

		task4 = blockchain.openContract(await Task4.fromInit(1n));
		const deployer = await blockchain.treasury('deployer');
		const deployResult = await task4.send(
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
			to: task4.address,
			deploy: true,
			success: true,
		});
	});

	const assignOwnership = async (prevOwner: Address, cell: Cell): Promise<SendMessageResult> => {
		const _sender = blockchain.sender(sender);
		return await task4.send(
			_sender,
			{
				value: toNano('1'),
			},
			{
				$$type: 'OwnershipAssigned',
				queryId: 0n,
				prevOwner,
				forwardPayload: cell,
			}
		);
	};

	const withdrawalNft = async (senderAddress: Address, nftForWithdrawal: Address): Promise<SendMessageResult> => {
		const _sender = blockchain.sender(senderAddress);
		return await task4.send(
			_sender,
			{
				value: toNano('1'),
			},
			{
				$$type: 'NftWithdrawal',
				queryId: 0n,
				nftAddress: nftForWithdrawal,
			}
		);
	};

	it('set data', async () => {
		const futureTime = new Date();
		futureTime.setDate(futureTime.getDate() + 7);
		const futureUtc = BigInt(Math.round(futureTime.getTime() / 1000));
		const r = await assignOwnership(owner, beginCell().storeAddress(nft).storeUint(futureUtc, 32).endCell());

		expect(await task4.getTime()).toBeGreaterThanOrEqual(BigInt(7 * 24 * 60 * 60));

		expect(await task4.getOwner()).toEqualAddress(owner);
		expect(await task4.getNft()).toEqualAddress(nft);

		expect(r.transactions.length).toBe(1);
	});

	it('revert nft back if already exists', async () => {
		const futureTime = new Date();
		futureTime.setDate(futureTime.getDate() + 7);
		const futureUtc = BigInt(Math.round(futureTime.getTime() / 1000));
		const r1 = await assignOwnership(owner, beginCell().storeAddress(nft).storeUint(futureUtc, 32).endCell());

		expect(r1.transactions.length).toBe(1);

		const r2 = await assignOwnership(owner2, beginCell().storeAddress(nft2).storeUint(futureUtc, 32).endCell());

		expect(r2.transactions.length).toBe(2);
	});

	it('try to withdrawal by not owner', async () => {
		const futureTime = new Date();
		futureTime.setDate(futureTime.getDate() + 7);
		const futureUtc = BigInt(Math.round(futureTime.getTime() / 1000));
		await assignOwnership(owner, beginCell().storeAddress(nft).storeUint(futureUtc, 32).endCell());

		let r = await withdrawalNft(owner2, nft);

		expect(r.events[0].type).toBe("message_sent");
		// expect((r.events[0] as any).body.toString()).toBe("message_sent");
	});

	fit('test', async () => {
		const futureTime = new Date();
		futureTime.setDate(futureTime.getDate() + 7);
		const futureUtc = BigInt(Math.round(futureTime.getTime() / 1000));
		await assignOwnership(owner, beginCell().storeAddress(nft).storeUint(futureUtc, 32).endCell());

		const cell = await task4.getT();
		// 299 150 - 32 117 149
		const dict = cell.beginParse().loadBuffer(37);
		// const keys = dict.keys();
		// const values = dict.values();
		expect(dict.toString()).toBe('test');
	});
});


