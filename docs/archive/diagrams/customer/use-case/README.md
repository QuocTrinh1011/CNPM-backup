# Customer use-case diagrams

The Customer use-case diagrams include one overview and one detailed diagram for each of the eight primary CRM and Sales functions.

| Code | Diagram source | Image |
| --- | --- | --- |
| Overview | `plantuml/III-00-customer-use-case.puml` | `images/III-00-customer-use-case.png` |
| III-01 | `plantuml/III-01-registration-use-case.puml` | `images/III-01-registration-use-case.png` |
| III-02 | `plantuml/III-02-login-refresh-logout-use-case.puml` | `images/III-02-login-refresh-logout-use-case.png` |
| III-03 | `plantuml/III-03-profile-preference-use-case.puml` | `images/III-03-profile-preference-use-case.png` |
| III-04 | `plantuml/III-04-feedback-rating-verified-purchase-use-case.puml` | `images/III-04-feedback-rating-verified-purchase-use-case.png` |
| III-05 | `plantuml/III-05-survey-response-use-case.puml` | `images/III-05-survey-response-use-case.png` |
| III-06 | `plantuml/III-06-product-catalog-use-case.puml` | `images/III-06-product-catalog-use-case.png` |
| III-07 | `plantuml/III-07-shopping-cart-order-payos-use-case.puml` | `images/III-07-shopping-cart-order-payos-use-case.png` |
| III-08 | `plantuml/III-08-order-history-status-tracking-use-case.puml` | `images/III-08-order-history-status-tracking-use-case.png` |

The detailed textual specifications are available at [`../../../use-cases/customer/customer-use-case-specifications.docx`](../../../use-cases/customer/customer-use-case-specifications.docx).

## Render

```powershell
java -jar plantuml.jar -tpng -o ..\images plantuml\*.puml
```
