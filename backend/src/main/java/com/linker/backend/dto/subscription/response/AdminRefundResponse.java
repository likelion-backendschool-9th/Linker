package com.linker.backend.dto.subscription.response;

public record AdminRefundResponse(long paymentId,String status,int refundedAmount,boolean refunded) {}
