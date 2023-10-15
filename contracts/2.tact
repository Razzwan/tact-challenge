import "@stdlib/deploy";

/*
  TASK 2 - Proxy contract
  Create a contract that forwards all messages sent and tokens received
  to the admin contract (the address will be set in init_store).
  Transaction from proxy contract to admin contract should contain
    - Address, of user who sent trx (should be stored in the body cell).
    - Original message that proxy smart contract received from user (should be stored in the first ref in the outcoming body).
  Also, if admin contract will bounce message (Bounced / opcode 0x44), then you need to send all ton`s back to user.
  User address will be given in bounced msg body as "sender".
*/

message(0x44) Bounced {
  queryId: Int as uint64;
  sender: Address;
}

contract Task2 with Deployable {
  admin: Address;

  init(admin: Address) {
    self.admin = admin;
  }

  receive(msg: Bounced) {
      let ctx: Context = context();
      send(SendParameters{
        to: msg.sender,
        value: 0,
        mode: SendRemainingValue,
        bounce: true,
        body: beginCell().endCell()
      });
  }

  receive(msg: Slice) {
    let ctx: Context = context();
    send(SendParameters{
      to: self.admin,
      value: 0,
      mode: SendRemainingValue,
      bounce: true,
      body: beginCell()
        .storeAddress(ctx.sender)
        .storeRef(
            beginCell().storeSlice(msg).endCell()
        ).endCell()
    });
  }
}

