import { Blockchain, SandboxContract, SendMessageResult } from '@ton-community/sandbox';
import {Address, beginCell, Cell, Sender, toNano} from 'ton-core';
import { Task4 } from '../wrappers/Task4';
import '@ton-community/test-utils';
import {gasCompare} from '../util/gas-usage';

type S = Sender & {
	address: Address;
}

describe('Task4', () => {
	let blockchain: Blockchain;
	let task4: SandboxContract<Task4>;
	let nft: S;
	let nft2: S;
	let owner: Address;
	let owner2: Address;
	let sender: Address;

	beforeEach(async () => {
		blockchain = await Blockchain.create();

		const addresses = await blockchain.createWallets(5);
		nft = addresses[0].getSender();
		nft2 = addresses[1].getSender();
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

	const assignOwnership = async (by: S, prevOwner: Address, cell: Cell): Promise<SendMessageResult> => {
		return await task4.send(
			by,
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
		const r = await assignOwnership(nft, owner, beginCell().storeUint(futureUtc, 32).endCell());

		expect(await task4.getTime()).toBeGreaterThanOrEqual(BigInt(7 * 24 * 60 * 60));

		expect(await task4.getOwner()).toEqualAddress(owner);
		expect(await task4.getNft()).toEqualAddress(nft.address);

		expect(r.transactions.length).toBe(2);
		gasCompare(r, 9950325n);
	});

	it('revert nft back if already exists', async () => {
		const futureTime = new Date();
		futureTime.setDate(futureTime.getDate() + 7);
		const futureUtc = BigInt(Math.round(futureTime.getTime() / 1000));
		const r1 = await assignOwnership(nft, owner, beginCell().storeUint(futureUtc, 32).endCell());

		expect(r1.transactions.length).toBe(2);

		const r2 = await assignOwnership(nft2, owner2, beginCell().storeUint(futureUtc, 32).endCell());

		expect(r2.transactions.length).toBe(3);

		gasCompare(r1, 9950325n);
		gasCompare(r2, 17080649n);
	});

	it('try to withdrawal by not owner', async () => {
		const futureTime = new Date();
		futureTime.setDate(futureTime.getDate() + 7);
		const futureUtc = BigInt(Math.round(futureTime.getTime() / 1000));
		await assignOwnership(nft, owner, beginCell().storeUint(futureUtc, 32).endCell());

		let r = await withdrawalNft(owner2, nft.address);

		expect(r.events[0].type).toBe('message_sent');
		gasCompare(r, 5149328n);
	});
});
