import "@stdlib/deploy";

/*
  TASK 5 - NFT random swap
  The smart contract contains a bunch of different NFTs.
  A user brings his NFT (sends it to the smart contract), with 2.1 TON (2 for admin's profit, 0.1 for gas) in attachment (as fee for swap).
  The smart contract randomly chooses some NFT from the available NFTs (including the newly incoming one) and gives it to the user in exchange for the brought NFT (but occasionally just returns user's NFT in some cases).
  Admin can deposit NFTs without swap logic. Any NFT received from the admin is considered deposited. Admin can't swap.
  Admin can withdraw all NFTs at once, and also all TONs collected from users as fees.
  Implement getter that will return NFT addresses held by the smart contract.
  Implement getter that will return the amount of admin`s profit collected.

  In details, the smart contract (later: SC) should have this logic:
  Messages
  * AdminWithdrawalProfit
   - SC should check that sender is the admin / otherwise throw "Insufficient privelegies"
   - SC should send all collected fees to admin except 0.1 TON (use AdminFetchProfit message as body)
     In other words: after each such operation, the contract's balance should be equal to 0.1 TON (which are reserved for storage) and the rest should be sent to the admin
  * AdminWithdrawalAllNFTs
   - SC should check that incoming tx TON value is enough for NFT withdrawal. Specifically, at least: (1 + totalNftsHeld * 0.08) TONs. Otherwise throw "Insufficent funds"
   - SC should check that sender is the admin, throw "Invalid sender" otherwise
   - If all checks pass, SC should send NFTs one by one to the admin
   - SC should be able to withdraw all NFTs by a single message from admin
  * OwnershipAssigned
   - if prevOwner is the owner's (admin) address, then add NFT to the collection
   - if value of TON attached is less then 2.1 TON then stop execution and return NFT back,
     but only in case that TON attached is enough to process refund without losing TONs on the SC's balance
   - randomly select NFT to send from all the NFTs that smart contract has
   - send the selected NFT to the sender with all remaining balance (except for admin profit = fees collected from this and other swaps)
     In other words: the contract's balance should increase by exactly 2 TON, some incoming TONs will be consumed for gas and the remainings of the incoming TONs should be refunded to the sender

  Getters
  * profit
   - returns how much collected fees is available to withdraw for the admin (all fees minus 0.1 TON)
  * nfts
   - returns dict of held NFTs with NFT indexes (sequential numbers from 0, 1, 2 ... and up to 'totalNftsHeld-1') as keys and NFT address as values
     the order of NFTs in this dictionary doesn't matter
*/

message AdminWithdrawalProfit {
  queryId: Int as uint64;
}

message AdminWithdrawalAllNFTs {
  queryId: Int as uint64;
}

message AdminFetchProfit {
  queryId: Int as uint64;
}

message(0x05138d91) OwnershipAssigned {
  queryId: Int as uint64;
  prevOwner: Address;
  forwardPayload: Slice as remaining;
}

message(0x5fcc3d14) Transfer {
  queryId: Int as uint64;
  newOwner: Address;
  responseDestination: Address;
  customPayload: Cell?;
  forwardAmount: Int as coins;
  forwardPayload: Slice as remaining;
}

contract Task5 with Deployable {
  const MinTonsForStorage: Int = ton("0.1");
  const ExchangeFee: Int = ton("2.1");

  nfts: map<Int as uint16, Address>;
  owner: Address;
  seed: Int as uint128;
  total: Int as uint16;

  init(seed: Int, owner: Address) {
    self.owner = owner;
    self.seed = seed;
    self.total = 0;
  }

  receive(msg: OwnershipAssigned) {
    if (msg.prevOwner == self.owner) {
      self.nfts.set(self.total, sender());
      self.total = self.total + 1;
      return;
    }

    let ctx: Context = context();
    let excess: Int = ctx.value - self.ExchangeFee;

    if (excess < 0) {
      require(ctx.value > self.MinTonsForStorage, "Insufficient funds");
      send(SendParameters{
        to: ctx.sender,
        value: 0,
        mode: SendRemainingValue,
        body: Transfer{
          queryId: msg.queryId,
          newOwner: msg.prevOwner,
          responseDestination: msg.prevOwner,
          customPayload: null,
          forwardAmount: 0,
          forwardPayload: emptySlice()
        }.toCell()
      });
      return;
    }

    let idx: Int = random(0, self.total - 1);

    send(SendParameters{
      to: self.nfts.get(idx)!!,
      value: ton("0.03"),
      body: Transfer{
        queryId: msg.queryId,
        newOwner: msg.prevOwner,
        responseDestination: msg.prevOwner,
        customPayload: null,
        forwardAmount: excess,
        forwardPayload: emptySlice()
      }.toCell()
    });

    self.nfts.set(idx, ctx.sender);
  }

  receive(msg: AdminWithdrawalProfit) {
    let ctx: Context = context();

    require(self.owner == ctx.sender, "Insufficient privileges");

    let amount: Int = myBalance() - self.MinTonsForStorage - ctx.value;

    require(amount > 0, "Insufficient funds");

    send(SendParameters{
      to: ctx.sender,
      value: amount,
      mode: SendRemainingValue + SendIgnoreErrors,
      body: AdminFetchProfit {
        queryId: msg.queryId
      }.toCell()
    });
  }

  receive(msg: AdminWithdrawalAllNFTs) {
    let ctx: Context = context();

    require(ctx.sender == self.owner || ctx.sender == myAddress(), "Invalid sender");

    let fees: Int = ton("1") + self.total * ton("0.05");

    require(ctx.value >= fees, "Insufficient funds");

    let body: Cell = Transfer{
      queryId: msg.queryId,
      newOwner: self.owner,
      responseDestination: self.owner,
      customPayload: null,
      forwardAmount: 0,
      forwardPayload: emptySlice()
    }.toCell();

    repeat(min(100, self.total)) {
      self.total = self.total - 1;

      send(SendParameters{
        to: self.nfts.get(self.total)!!,
        value: ton("0.03"),
        mode: SendIgnoreErrors,
        body: body
      });
    }

    if (self.total == 0) {
      self.nfts = emptyMap();
      return;
    }

    send(SendParameters{
      to: myAddress(),
      value: 0,
      mode: SendRemainingValue + SendIgnoreErrors,
      body: AdminWithdrawalAllNFTs{
        queryId: msg.queryId
      }.toCell()
    });
  }

  get fun profit(): Int {
    return myBalance() - self.MinTonsForStorage;
  }

  get fun nfts(): map<Int as uint16, Address> {
    return self.nfts;
  }
}
