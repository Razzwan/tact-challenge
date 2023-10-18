import {Blockchain, SandboxContract, SendMessageResult} from '@ton-community/sandbox';
import {Address, beginCell, Sender, toNano} from 'ton-core';
import {Task5} from '../wrappers/Task5';
import '@ton-community/test-utils';
import {gasCompare, gasUsage} from '../util/gas-usage';

// import { verify } from "@tact-lang/compiler";

type S = Sender & {
	address: Address;
}

describe('Task5', () => {
	let blockchain: Blockchain;
	let task5: SandboxContract<Task5>;
	let owner: S;
	let notOwner: S;
	let nft1: S;
	let nft2: S;
	let nft3: S;
	let nft4: S;
	let nft5: S;

	beforeEach(async () => {
		blockchain = await Blockchain.create();

		const addresses = await blockchain.createWallets(7);

		owner = addresses[0].getSender();
		notOwner = addresses[1].getSender();
		nft1 = addresses[2].getSender();
		nft2 = addresses[3].getSender();
		nft3 = addresses[4].getSender();
		nft4 = addresses[5].getSender();
		nft5 = addresses[6].getSender();

		task5 = blockchain.openContract(await Task5.fromInit(0n, owner.address));
		// const deployer = await blockchain.treasury('deployer');
		const deployResult = await task5.send(
			owner,
			{
				value: toNano('0.05'),
			},
			{
				$$type: 'Deploy',
				queryId: 0n,
			}
		);
		expect(deployResult.transactions).toHaveTransaction({
			from: owner.address,
			to: task5.address,
			deploy: true,
			success: true,
		});
	});

	const addNft = async (prevOwner: S, nft: S, amount: number): Promise<SendMessageResult> => {
		return await task5.send(
			nft,
			{
				value: toNano(amount.toString()),
			},
			{
				$$type: 'OwnershipAssigned',
				queryId: 0n,
				prevOwner: prevOwner.address,
				forwardPayload: beginCell().endCell(),
			}
		);
	};

	const withdrawal = async (by: S): Promise<SendMessageResult> => {
		return await task5.send(
			by,
			{
				value: toNano('0.05'),
			},
			{
				$$type: 'AdminWithdrawalProfit',
				queryId: 0n,
			}
		);
	};

	it('add 1 nft by owner', async () => {
		const r = await addNft(owner, nft1, 0.2);

		expect(await task5.getProfit()).toBeGreaterThanOrEqual(0n);

		expect((await task5.getNfts()).get(0)).toEqualAddress(nft1.address);

		gasCompare(r, 9930659n);
	});

	it('add 2 nft by owner', async () => {
		const r1 = await addNft(owner, nft1, 0.2);
		const r2 = await addNft(owner, nft2, 0.2);

		expect(await task5.getProfit()).toBeGreaterThanOrEqual(0n);

		expect((await task5.getNfts()).get(0)).toEqualAddress(nft1.address);
		expect((await task5.getNfts()).get(1)).toEqualAddress(nft2.address);

		gasCompare(r1, 9930659n);
		gasCompare(r2, 11030659n);
	});

	it('add 3 nft by owner', async () => {
		const r1 = await addNft(owner, nft1, 0.2);
		const r2 = await addNft(owner, nft2, 0.2);
		const r3 = await addNft(owner, nft3, 0.2);

		expect(await task5.getProfit()).toBeGreaterThanOrEqual(0n);

		expect((await task5.getNfts()).get(0)).toEqualAddress(nft1.address);
		expect((await task5.getNfts()).get(1)).toEqualAddress(nft2.address);
		expect((await task5.getNfts()).get(2)).toEqualAddress(nft3.address);

		gasCompare(r1, 9930659n);
		gasCompare(r2, 11030659n);
		gasCompare(r3, 11030659n);
	});

	it('replace nft by other person not enough amount', async () => {
		await addNft(owner, nft1, 0.2);
		await addNft(owner, nft2, 0.2);
		await addNft(owner, nft3, 0.2);

		const r = await addNft(notOwner, nft4, 2.0);

		expect((await task5.getNfts()).get(0)).toEqualAddress(nft1.address);
		expect((await task5.getNfts()).get(1)).toEqualAddress(nft2.address);
		expect((await task5.getNfts()).get(2)).toEqualAddress(nft3.address);
		expect((await task5.getNfts()).values().map(addr => addr.toRaw())).not.toEqual(expect.arrayContaining([nft4.address.toRaw()]));

		gasCompare(r, 15935983n);
	});

	it('replace nft by other person enough amount', async () => {
		await addNft(owner, nft1, 0.2);
		await addNft(owner, nft2, 0.2);
		await addNft(owner, nft3, 0.2);

		const r = await addNft(notOwner, nft4, 2.1);

		expect((await task5.getNfts()).values().map(addr => addr.toRaw())).toEqual(expect.arrayContaining([nft4.address.toRaw()]));

		gasCompare(r, 18673983n);
	});

	it('balance after withdrawal', async () => {
		await addNft(owner, nft1, 0.2);
		await addNft(owner, nft2, 0.2);
		await addNft(owner, nft3, 0.2);

		const r1 = await addNft(notOwner, nft4, 3);

		const r2 = await withdrawal(owner);

		expect(await task5.getProfit()).toEqual(0n);

		gasCompare(r1, 18684650n);

		gasCompare(r2, 13682988n);
	});
});
